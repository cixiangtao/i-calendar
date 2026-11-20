import type { DateKey } from '@i-calendar/core';
import type { DailySignStorage } from '@i-calendar/ui';

const storeName = 'draws';

/** 用同一事务完成首次抽签的读写，确保多个标签页取回同一张签。 */
export function createDailySignStorage(): DailySignStorage {
  let connection: Promise<IDBDatabase> | undefined;

  function openDatabase() {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('i-calendar:daily-sign', 1);
      request.addEventListener('upgradeneeded', () => request.result.createObjectStore(storeName));
      request.addEventListener('error', () => reject(request.error));
      request.addEventListener('success', () => {
        const database = request.result;
        database.addEventListener('versionchange', () => {
          database.close();
          connection = undefined;
        });
        resolve(database);
      });
    }).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
    return connection;
  }

  // 不传种子时查询，传 null 时清除指定日期的记录。
  async function access(date: DateKey, nextSeed?: string | null) {
    const database = await openDatabase();
    return new Promise<string | undefined>((resolve, reject) => {
      const transaction = database.transaction(
        storeName,
        nextSeed === undefined ? 'readonly' : 'readwrite',
      );
      const store = transaction.objectStore(storeName);
      let seed: string | undefined;
      if (nextSeed === null) {
        store.delete(date);
      } else {
        const request = store.get(date);
        request.addEventListener('success', () => {
          const saved: unknown = request.result;
          if (typeof saved === 'string' && /^[a-f0-9]{32}$/.test(saved)) {
            seed = saved;
          } else if (nextSeed !== undefined) {
            seed = nextSeed;
            store.delete(IDBKeyRange.upperBound(date, true));
            store.put(seed, date);
          }
        });
      }
      transaction.addEventListener('complete', () => resolve(seed));
      transaction.addEventListener('abort', () => reject(transaction.error));
    });
  }

  return {
    load: (date) => access(date),
    async draw(date, seed) {
      const saved = await access(date, seed);
      if (saved === undefined) throw new Error('抽签种子未保存');
      return saved;
    },
    async reset(date) {
      await access(date, null);
    },
  };
}

import type { CalendarPlatform, SavedCalendarState } from '@shiri/calendar-ui';
import { isTauri, invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'shiri-calendar:state:v1';

/** 普通浏览器只使用公开数据、本地存储和浏览器系统能力。 */
function browserPlatform(): CalendarPlatform {
  return {
    kind: 'web',
    async load() {
      const value = localStorage.getItem(STORAGE_KEY);
      return value ? (JSON.parse(value) as unknown) : null;
    },
    async save(state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    async fetchHolidayYear(year, signal) {
      const timeout = new AbortController();
      const timer = window.setTimeout(() => timeout.abort(), 12_000);
      const abort = () => timeout.abort();
      signal.addEventListener('abort', abort, { once: true });
      try {
        if (signal.aborted) throw new Error('查询已取消');
        const response = await fetch(
          `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
          { signal: timeout.signal, cache: 'no-store', credentials: 'omit' },
        );
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('数据下载失败');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('数据流不可用');
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          length += item.value.byteLength;
          if (length > 1_000_000) {
            await reader.cancel();
            throw new Error('调休数据超过大小限制');
          }
          chunks.push(item.value);
        }
        const data = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return JSON.parse(new TextDecoder().decode(data)) as unknown;
      } finally {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    },
    async openExternal(url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) opened.opener = null;
    },
    async copyText(text) {
      await navigator.clipboard.writeText(text);
    },
  };
}

/** 原生能力通过 Rust 命令或受限插件实现，界面逻辑与 Web 保持相同。 */
export async function createPlatform(): Promise<{
  platform: CalendarPlatform;
  smokeTest: boolean;
}> {
  if (!isTauri()) return { platform: browserPlatform(), smokeTest: false };
  const context = await invoke<{ kind: 'macos' | 'ios'; smokeTest: boolean }>('runtime_context');
  return {
    smokeTest: context.smokeTest,
    platform: {
      kind: context.kind,
      load: () => invoke<unknown>('load_state'),
      save: (state: SavedCalendarState) => invoke<void>('save_state', { state }),
      async fetchHolidayYear(year, signal) {
        if (signal.aborted) throw new Error('查询已取消');
        const result = await invoke<unknown>('fetch_holiday_year', { year });
        if (signal.aborted) throw new Error('查询已取消');
        return result;
      },
      async openExternal(url) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(url);
      },
      async copyText(text) {
        const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
        await writeText(text);
      },
      setInteractionBusy: (busy) => invoke<void>('set_popup_busy', { busy }),
      ...(context.kind === 'macos'
        ? { close: () => invoke<void>('close_calendar'), quit: () => invoke<void>('quit_calendar') }
        : {}),
    },
  };
}

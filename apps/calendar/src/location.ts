import type { LocatedPoint } from '@i-calendar/ui';
import { invoke } from '@tauri-apps/api/core';

/** 地名失败时使用附近参考点标签，绝不把参考点坐标写回定位结果。 */
async function withNearbyName(point: LocatedPoint): Promise<LocatedPoint> {
  if (point.label) return point;
  try {
    const { nearestSunlightPlace } = await import('@i-calendar/core/places');
    const nearby = nearestSunlightPlace(point);
    return { ...point, label: nearby ? `${nearby.region} · ${nearby.name}附近` : '当前位置' };
  } catch {
    return { ...point, label: '当前位置' };
  }
}

/** 浏览器只获取一次定位；收到首个结果或取消后立即清理 watch。 */
export function browserLocate(signal: AbortSignal): Promise<LocatedPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation || !window.isSecureContext) {
      reject(new Error('当前浏览器不支持定位，请手动选择城市'));
      return;
    }
    if (signal.aborted) {
      reject(new Error('定位已取消'));
      return;
    }
    let watch: number | undefined;
    let done = false;
    const cleanup = () => {
      done = true;
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      signal.removeEventListener('abort', cancel);
      window.clearTimeout(timer);
    };
    const cancel = () => {
      cleanup();
      reject(new Error('定位已取消'));
    };
    // 额外超时涵盖权限弹窗未操作的情况，浏览器自身 timeout 不一定计入授权等待。
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('定位超时，请重试或手动选择城市'));
    }, 30_000);
    signal.addEventListener('abort', cancel, { once: true });
    watch = navigator.geolocation.watchPosition(
      (position) => {
        if (done) return;
        cleanup();
        void withNearbyName({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }).then(resolve, reject);
      },
      (error) => {
        if (done) return;
        cleanup();
        reject(
          new Error(
            error.code === 1
              ? '定位权限未开启，请允许浏览器定位或手动选择城市'
              : error.code === 3
                ? '定位超时，请重试或手动选择城市'
                : '暂时无法获取位置，请检查定位服务或选择城市',
          ),
        );
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
    );
    if (done) navigator.geolocation.clearWatch(watch);
  });
}

/** Apple 原生系统定位及区县/道路标签；只将返回坐标用于本地日照计算。 */
export async function nativeLocate(signal: AbortSignal): Promise<LocatedPoint> {
  // 页面重载后也不复用请求编号，避免旧页面的取消消息命中新请求。
  const nonce = crypto.getRandomValues(new Uint32Array(2));
  const id = (nonce[0]! & 0x1fffff) * 0x1_0000_0000 + nonce[1]!;
  if (signal.aborted) throw new Error('定位已取消');
  let abortReject!: (reason: Error) => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abortReject = reject;
  });
  const cancel = () => {
    void invoke('cancel_sunlight_location', { requestId: id }).catch(() => {});
    abortReject(new Error('定位已取消'));
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const work = async () => {
      const point = await invoke<LocatedPoint>('locate_sunlight', { requestId: id });
      if (signal.aborted) throw new Error('定位已取消');
      const label = await invoke<string | null>('describe_sunlight_location', {
        requestId: id,
        latitude: point.latitude,
        longitude: point.longitude,
      }).catch(() => null);
      return withNearbyName({ ...point, label: label ?? undefined });
    };
    return await Promise.race([work(), cancelled]);
  } catch (error) {
    throw new Error(
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : '定位失败，请重试或选择城市',
      { cause: error },
    );
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CalendarPlatform, SavedCalendarState } from '../src/platform.js';
import { CalendarController, parseSavedState } from '../src/store.js';
import {
  LocationRequestError,
  parseSunlightPreferences,
  type LocatedPoint,
} from '../src/sunlight-location.js';

const place = {
  id: '1816670',
  name: '北京市',
  region: '北京',
  latitude: 39.9075,
  longitude: 116.39723,
};
const start = Date.parse('2026-11-17T04:00:00Z');
function fixture(locate?: CalendarPlatform['locate']) {
  let time = start;
  const saves: SavedCalendarState[] = [];
  const platform: CalendarPlatform = {
    kind: 'web',
    load: async () => null,
    save: async (state) => {
      saves.push(structuredClone(state));
    },
    fetchHolidayYear: async () => null,
    openExternal: async () => {},
    copyText: async () => {},
    locate,
  };
  const controller = new CalendarController(platform, () => new Date(time));
  return {
    controller,
    saves,
    platform,
    advance: (amount: number) => {
      time += amount;
    },
    now: () => time,
  };
}
const fix = (timestamp = start): LocatedPoint => ({
  latitude: 39.95,
  longitude: 116.45,
  accuracy: 30,
  timestamp,
  label: '北京 · 朝阳区 · 示例道路',
});

test('旧偏好默认不启用定位，初始化不申请权限', async () => {
  let requests = 0;
  const { controller } = fixture(async () => {
    requests++;
    return fix();
  });
  await controller.initialize();
  await controller.locateSunlight(true);
  assert.equal(requests, 0);
  assert.deepEqual(parseSunlightPreferences(undefined), { mode: 'off', manualLocation: null });
});

test('只有用户操作允许申请新权限，自动刷新遇到未授权保留主动申请入口', async () => {
  const requests: boolean[] = [];
  const env = fixture(async (_signal, requestPermission) => {
    requests.push(requestPermission);
    if (!requestPermission)
      throw new LocationRequestError('permission-required', '请点击申请定位权限');
    return fix(env.now());
  });
  await env.controller.initialize();
  await env.controller.locateSunlight();
  env.advance(31 * 60_000);
  await env.controller.locateSunlight(true);
  assert.deepEqual(requests, [true, false]);
  assert.equal(env.controller.getSnapshot().sunlightLocation.issue, 'permission-required');
  await env.controller.locateSunlight(true);
  assert.equal(requests.length, 2);
  await env.controller.locateSunlight();
  assert.deepEqual(requests, [true, false, true]);
  assert.equal(env.controller.getSnapshot().sunlightLocation.issue, undefined);
});

test('应用拒绝、系统关闭和设备限制保留不同的恢复状态', async () => {
  for (const code of ['permission-denied', 'services-disabled', 'restricted'] as const) {
    const { controller } = fixture(async () => {
      throw new LocationRequestError(code, '定位暂不可用');
    });
    await controller.initialize();
    await controller.locateSunlight();
    assert.equal(controller.getSnapshot().sunlightLocation.issue, code);
    await controller.selectSunlightPlace(place);
    assert.equal(controller.getSnapshot().sunlightLocation.issue, undefined);
  }
});

test('手动地点保存重载可离线使用，并复制保存值', async () => {
  const { controller, saves, platform } = fixture();
  await controller.initialize();
  await controller.selectSunlightPlace(place);
  assert.equal(parseSavedState(saves.at(-1)).preferences.sunlight.mode, 'manual');
  const restored = new CalendarController({ ...platform, load: async () => saves.at(-1) });
  await restored.initialize();
  assert.deepEqual(restored.getSnapshot().preferences.sunlight.manualLocation, place);
  assert.notEqual(restored.getSnapshot().preferences.sunlight.manualLocation, place);
});

test('实际定位坐标只留在内存，其他偏好保存也不泄漏到持久化', async () => {
  const { controller, saves } = fixture(async () => fix());
  await controller.initialize();
  await controller.locateSunlight();
  assert.deepEqual(controller.getSnapshot().sunlightLocation.point, fix());
  await controller.setPreferences({ appearance: 'dark' });
  const serialized = JSON.stringify(saves);
  assert.ok(!serialized.includes('116.45') && !serialized.includes('示例道路'));
  assert.deepEqual(saves.at(-1)!.preferences.sunlight, { mode: 'automatic', manualLocation: null });
});

test('前台刷新限频，拒绝授权后停止自动重试，主动重试可恢复', async () => {
  let count = 0;
  const env = fixture(async () => {
    count++;
    if (count === 1) throw new Error('定位权限未开启');
    return fix(env.now());
  });
  await env.controller.initialize();
  await env.controller.locateSunlight();
  env.advance(31 * 60_000);
  await env.controller.locateSunlight(true);
  assert.equal(count, 1);
  await env.controller.locateSunlight();
  await env.controller.locateSunlight(true);
  assert.equal(count, 2);
  env.advance(31 * 60_000);
  await env.controller.locateSunlight(true);
  assert.equal(count, 3);
});

test('手动切换中止定位，迟到回调不能覆盖用户选择', async () => {
  let complete!: (point: LocatedPoint) => void;
  let signal: AbortSignal | undefined;
  const { controller } = fixture(async (value) => {
    signal = value;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  await controller.initialize();
  const request = controller.locateSunlight();
  await controller.selectSunlightPlace(place);
  assert.equal(signal?.aborted, true);
  complete(fix());
  await request;
  assert.equal(controller.getSnapshot().preferences.sunlight.mode, 'manual');
  assert.equal(controller.getSnapshot().sunlightLocation.point, null);
});

test('主动取消立即恢复操作，旧结果不覆盖随后发起的定位', async () => {
  const complete: ((point: LocatedPoint) => void)[] = [];
  const signals: AbortSignal[] = [];
  const { controller } = fixture((signal) => {
    signals.push(signal);
    return new Promise((resolve) => complete.push(resolve));
  });
  await controller.initialize();
  const first = controller.locateSunlight();
  assert.equal(controller.getSnapshot().sunlightLocation.pending, true);
  controller.cancelSunlightLocation();
  assert.equal(signals[0]?.aborted, true);
  assert.equal(controller.getSnapshot().sunlightLocation.pending, false);
  const second = controller.locateSunlight();
  complete[0]!(fix());
  await first;
  assert.equal(controller.getSnapshot().sunlightLocation.pending, true);
  assert.equal(controller.getSnapshot().sunlightLocation.point, null);
  complete[1]!({ ...fix(), accuracy: 50 });
  await second;
  assert.equal(controller.getSnapshot().sunlightLocation.point?.accuracy, 50);
  assert.equal(controller.getSnapshot().sunlightLocation.pending, false);
});

test('并发点击只启动一个请求，关闭会取消，销毁后回调不更新', async () => {
  let requests = 0;
  let complete!: (point: LocatedPoint) => void;
  const { controller } = fixture(async () => {
    requests++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  await controller.initialize();
  const first = controller.locateSunlight();
  await controller.locateSunlight();
  assert.equal(requests, 1);
  controller.dispose();
  const snapshot = controller.getSnapshot();
  complete(fix());
  await first;
  assert.equal(controller.getSnapshot(), snapshot);
});

test('过期缓存、负精度和无效坐标不能显示为新定位', async () => {
  for (const point of [
    fix(start - 180_000),
    { ...fix(), accuracy: -1 },
    { ...fix(), latitude: NaN },
  ]) {
    const { controller } = fixture(async () => point);
    await controller.initialize();
    await controller.locateSunlight();
    assert.equal(controller.getSnapshot().sunlightLocation.point, null);
    assert.match(controller.getSnapshot().sunlightLocation.error!, /无效或已过期/);
  }
});

test('以收到坐标的时间判断新鲜度，地名等待及过长标签不影响有效位置', async () => {
  const env = fixture(async () => {
    const point = { ...fix(start - 119_000), receivedAt: env.now(), label: '区'.repeat(120) };
    env.advance(6_000);
    return point;
  });
  await env.controller.initialize();
  await env.controller.locateSunlight();
  const state = env.controller.getSnapshot().sunlightLocation;
  assert.equal(state.error, null);
  assert.equal(state.point?.timestamp, start - 119_000);
  assert.equal(state.point?.label?.length, 100);
});

test('刷新失败保留上次有效位置并明确错误，关闭后清除会话位置', async () => {
  let requests = 0;
  const { controller } = fixture(async () => {
    if (++requests > 1) throw new Error('定位超时');
    return fix();
  });
  await controller.initialize();
  await controller.locateSunlight();
  await controller.locateSunlight();
  assert.deepEqual(controller.getSnapshot().sunlightLocation.point, fix());
  assert.equal(controller.getSnapshot().sunlightLocation.error, '定位超时');
  await controller.setPreferences({ sunlight: { mode: 'off', manualLocation: null } });
  assert.deepEqual(controller.getSnapshot().sunlightLocation, {
    point: null,
    pending: false,
    error: null,
  });
});

test('导入设置只保留手动地点白名单，不接纳伪造的自动定位历史', () => {
  const parsed = parseSunlightPreferences({
    mode: 'automatic',
    manualLocation: null,
    point: fix(),
  });
  assert.deepEqual(parsed, { mode: 'automatic', manualLocation: null });
  assert.throws(() => parseSunlightPreferences({ mode: 'manual', manualLocation: null }));
  assert.throws(() =>
    parseSunlightPreferences({ mode: 'manual', manualLocation: { ...place, latitude: 91 } }),
  );
});

test('系统上次位置须确认才能计算，确认保留采样时间且坐标仅留在内存', async () => {
  const cached = { ...fix(start - 8 * 60 * 60_000), lastKnown: true, receivedAt: start };
  const env = fixture(async () => cached);
  await env.controller.initialize();
  await env.controller.locateSunlight();
  const state = env.controller.getSnapshot().sunlightLocation;
  assert.equal(state.point, null);
  assert.equal(state.pending, false);
  assert.equal(state.candidate?.timestamp, cached.timestamp);
  env.controller.confirmLastKnownLocation();
  assert.deepEqual(env.controller.getSnapshot().sunlightLocation.point, cached);
  assert.equal(env.controller.getSnapshot().sunlightLocation.candidate, undefined);
  await env.controller.setPreferences({ appearance: 'dark' });
  assert.ok(!JSON.stringify(env.saves).includes(String(cached.longitude)));
});

test('确认时已过一天或已切换手动地点，都不能启用系统上次位置', async () => {
  const env = fixture(async () => ({ ...fix(start - 86_400_000), lastKnown: true }));
  await env.controller.initialize();
  await env.controller.locateSunlight();
  env.advance(1);
  env.controller.confirmLastKnownLocation();
  assert.equal(env.controller.getSnapshot().sunlightLocation.point, null);
  assert.match(env.controller.getSnapshot().sunlightLocation.error!, /已过期/);
  await env.controller.selectSunlightPlace(place);
  env.controller.confirmLastKnownLocation();
  assert.equal(env.controller.getSnapshot().preferences.sunlight.mode, 'manual');
});

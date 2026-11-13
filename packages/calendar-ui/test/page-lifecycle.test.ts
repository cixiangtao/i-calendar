import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindPageLifecycle } from '../src/page-lifecycle.js';
import type { SavedCalendarState } from '../src/platform.js';
import { CalendarController } from '../src/store.js';

function transition(target: EventTarget, type: 'pagehide' | 'pageshow', persisted: boolean) {
  target.dispatchEvent(Object.defineProperty(new Event(type), 'persisted', { value: persisted }));
}

function fixture() {
  let now = new Date('2026-12-31T15:59:00Z');
  const writes: SavedCalendarState[] = [];
  const controller = new CalendarController(
    {
      kind: 'web',
      load: async () => null,
      save: async (state) => {
        writes.push(structuredClone(state));
      },
      fetchHolidayYear: async () => null,
      openExternal: async () => {},
      copyText: async () => {},
    },
    () => now,
  );
  const target = new EventTarget();
  const unbind = bindPageLifecycle(controller, target);
  return { controller, target, writes, unbind, setTime: (time: string) => (now = new Date(time)) };
}

test('页面从历史缓存跨年恢复，今天立即刷新，仍可选日并保存偏好', async () => {
  const { controller, target, setTime, writes, unbind } = fixture();
  await controller.initialize();
  transition(target, 'pagehide', true);
  setTime('2026-12-31T16:01:00Z');
  transition(target, 'pageshow', true);
  assert.equal(controller.getSnapshot().today, '2027-01-01');
  assert.equal(controller.getSnapshot().selected.date, '2027-01-01');
  controller.selectDate('2027-02-05');
  await controller.setPreferences({ appearance: 'dark' });
  assert.equal(controller.getSnapshot().selected.date, '2027-02-05');
  assert.equal(writes.at(-1)?.preferences.appearance, 'dark');
  unbind();
});

test('多次历史恢复保留手动浏览与设置面板，最终真正退出才销毁状态', async () => {
  const { controller, target, setTime, unbind } = fixture();
  await controller.initialize();
  controller.selectDate('2026-02-14');
  controller.showSettings();
  for (const time of ['2027-01-01T16:01:00Z', '2027-01-02T16:01:00Z']) {
    transition(target, 'pagehide', true);
    setTime(time);
    transition(target, 'pageshow', true);
    assert.equal(controller.getSnapshot().selected.date, '2026-02-14');
    assert.equal(controller.getSnapshot().panel, 'settings');
  }
  assert.equal(controller.getSnapshot().today, '2027-01-03');
  transition(target, 'pagehide', false);
  const stopped = controller.getSnapshot();
  controller.goToday();
  assert.equal(controller.getSnapshot(), stopped);
  unbind();
});

test('解绑页面生命周期后不再由页面事件销毁控制器', async () => {
  const { controller, target, unbind } = fixture();
  await controller.initialize();
  unbind();
  transition(target, 'pagehide', false);
  controller.selectDate('2027-01-01');
  assert.equal(controller.getSnapshot().selected.date, '2027-01-01');
});

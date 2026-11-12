import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  formatMenuClock,
  parseClockFormat,
  parseMenuClock,
  type MenuClockPreferences,
} from '../src/menu-clock.js';
import { CalendarController, parseSavedState } from '../src/store.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/menu-clock.json', import.meta.url), 'utf8'),
) as {
  cases: { date: string; format: string; expected: string }[];
  invalid: string[];
  visibility: { input: unknown; expected?: MenuClockPreferences }[];
};

test('时钟格式：与 Rust 共享午夜、中午、周几、年界、闰日及字面量样例', () => {
  for (const item of fixture.cases)
    assert.equal(formatMenuClock(item.format, new Date(item.date), 'Asia/Shanghai'), item.expected);
  assert.equal(
    formatMenuClock('MM-DD HH:mm', new Date('2026-11-12T00:05:09+08:00'), 'UTC'),
    '11-11 16:05',
  );
});

test('非法格式不进入持久化，旧偏好补齐默认菜单栏时钟设置', () => {
  for (const format of fixture.invalid) assert.throws(() => parseClockFormat(format), format);
  assert.throws(() => parseMenuClock({ enabled: 'true', format: 'HH:mm' }));
  const input = {
    schemaVersion: 1,
    preferences: { weekStartsOn: 1, appearance: 'system' },
    datasets: [],
  };
  assert.deepEqual(parseSavedState(input).preferences.menuClock, {
    enabled: true,
    showIcon: true,
    format: 'HH:mm',
  });
  assert.throws(() =>
    parseSavedState({
      ...input,
      preferences: {
        ...input.preferences,
        menuClock: { enabled: true, showIcon: true, format: 'bad' },
      },
    }),
  );
});

test('时钟偏好可保存、恢复、关闭，非法修改保留旧值', async () => {
  const writes: unknown[] = [];
  const platform = {
    kind: 'macos' as const,
    load: async () => null,
    save: async (state: unknown) => {
      writes.push(structuredClone(state));
    },
    fetchHolidayYear: async () => null,
    openExternal: async () => {},
    copyText: async () => {},
  };
  const controller = new CalendarController(platform);
  await controller.initialize();
  await controller.setPreferences({
    menuClock: { enabled: false, showIcon: true, format: 'HH:mm:ss' },
  });
  const restored = new CalendarController({ ...platform, load: async () => writes.at(-1) });
  await restored.initialize();
  assert.deepEqual(restored.getSnapshot().preferences.menuClock, {
    enabled: false,
    showIcon: true,
    format: 'HH:mm:ss',
  });
  assert.throws(() =>
    restored.setPreferences({ menuClock: { enabled: true, showIcon: true, format: 'bad' } }),
  );
  assert.equal(restored.getSnapshot().preferences.menuClock.enabled, false);
  await restored.setPreferences({
    menuClock: { enabled: true, showIcon: false, format: 'HH:mm:ss' },
  });
  assert.equal(parseSavedState(writes.at(-1)).preferences.menuClock.showIcon, false);
  assert.throws(() =>
    restored.setPreferences({ menuClock: { enabled: false, showIcon: false, format: 'HH:mm:ss' } }),
  );
  assert.equal(restored.getSnapshot().preferences.menuClock.enabled, true);
});

test('图标显隐兼容旧设置，并拒绝隐藏全部入口或空白时间', () => {
  for (const item of fixture.visibility) {
    if (item.expected) assert.deepEqual(parseMenuClock(item.input), item.expected);
    else assert.throws(() => parseMenuClock(item.input));
  }
});

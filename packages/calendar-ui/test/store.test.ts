import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CalendarPlatform, SavedCalendarState } from '../src/platform.js';
import { CalendarController, parseSavedState } from '../src/store.js';

const instant = new Date('2026-11-11T04:00:00Z');
function fixture(overrides: Partial<CalendarPlatform> = {}) {
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
    ...overrides,
  };
  return { controller: new CalendarController(platform, () => instant), saves };
}

test('月末切月、今天、方向键与周起始日在三端使用同一状态', async () => {
  const { controller, saves } = fixture();
  await controller.initialize();
  controller.selectDate('2026-01-31');
  controller.shiftMonth(1);
  assert.equal(controller.getSnapshot().selected.date, '2026-02-28');
  controller.goToday();
  assert.equal(controller.getSnapshot().selected.date, '2026-11-11');
  controller.moveSelection(-1);
  assert.equal(controller.getSnapshot().selected.date, '2026-11-10');
  await controller.setPreferences({ weekStartsOn: 7 });
  assert.equal(controller.getSnapshot().month.cells[0]?.date, '2026-11-01');
  assert.equal(saves.at(-1)?.preferences.weekStartsOn, 7);
});

test('缓存加载只执行一次；坏缓存回退内置数据且不自动覆盖', async () => {
  let loads = 0;
  const { controller, saves } = fixture({
    load: async () => {
      loads++;
      return { schemaVersion: 99 };
    },
  });
  await Promise.all([controller.initialize(), controller.initialize()]);
  assert.equal(loads, 1);
  assert.equal(saves.length, 0);
  assert.equal(controller.getSnapshot().selected.schedule.coverage, 'published');
  assert.match(controller.getSnapshot().error!, /读取失败/);
});

test('离线更新失败仍保留日历、已知休班与缓存，不出现成功提示', async () => {
  const { controller, saves } = fixture({
    fetchHolidayYear: async () => {
      throw new Error('offline');
    },
  });
  await controller.initialize();
  await controller.checkUpdates();
  assert.equal(controller.getSnapshot().updating, false);
  assert.equal(controller.engine.getDay('2026-02-14').schedule.kind, 'makeup-workday');
  assert.equal(controller.getSnapshot().notice, null);
  assert.equal(saves.length, 0);
  assert.match(controller.getSnapshot().error!, /更新失败/);
});

test('年度更新部分成功时只采用有效年份，年份不符的响应被拒绝', async () => {
  const { controller, saves } = fixture({
    fetchHolidayYear: async (year) =>
      year === 2026
        ? {
            year: 2026,
            papers: ['https://example.com/2026'],
            days: [{ name: '元旦', date: '2026-01-01', isOffDay: true }],
          }
        : { year: 2028 },
  });
  await controller.initialize();
  await controller.checkUpdates();
  assert.match(controller.getSnapshot().notice!, /2026/);
  assert.match(controller.getSnapshot().error!, /2027/);
  assert.equal(saves.length, 1);
});

test('导入后刷新已缓存日期的覆盖状态；无效导入不污染旧数据', async () => {
  const { controller, saves } = fixture();
  await controller.initialize();
  controller.selectDate('2028-01-01');
  assert.equal(controller.getSnapshot().month.coverage, 'unavailable');
  await controller.importDataset(
    JSON.stringify({
      year: 2028,
      papers: ['https://example.com/2028'],
      days: [{ date: '2028-01-01', name: '元旦', isOffDay: true }],
    }),
  );
  assert.equal(controller.getSnapshot().selected.schedule.kind, 'holiday');
  assert.equal(controller.getSnapshot().month.coverage, 'published');
  await controller.importDataset('{broken');
  assert.equal(controller.getSnapshot().selected.schedule.kind, 'holiday');
  assert.equal(saves.length, 1);
});

test('快速修改设置串行写入，保存失败有可恢复提示', async () => {
  const writes: SavedCalendarState[] = [];
  const { controller } = fixture({
    save: async (state) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      writes.push(state);
    },
  });
  await controller.initialize();
  await Promise.all([
    controller.setPreferences({ appearance: 'dark' }),
    controller.setPreferences({ appearance: 'light' }),
  ]);
  assert.equal(writes.at(-1)?.preferences.appearance, 'light');
  const broken = fixture({
    save: async () => {
      throw new Error('full');
    },
  }).controller;
  await broken.initialize();
  await broken.setPreferences({ appearance: 'dark' });
  assert.equal(broken.getSnapshot().preferences.appearance, 'dark');
  assert.match(broken.getSnapshot().error!, /保存失败/);
});

test('跨北京时间午夜：跟随今天继续跟随，手动浏览不会被重置', async () => {
  let now = new Date('2026-11-11T15:59:00Z');
  const { controller: first } = fixture();
  const controller = new CalendarController(first.platform, () => now);
  await controller.initialize();
  now = new Date('2026-11-11T16:01:00Z');
  controller.refreshToday();
  assert.equal(controller.getSnapshot().selected.date, '2026-11-12');
  controller.selectDate('2026-02-14');
  now = new Date('2026-11-12T16:01:00Z');
  controller.refreshToday();
  assert.equal(controller.getSnapshot().selected.date, '2026-02-14');
});

test('拒绝不兼容的持久化设置和非 HTTPS 外部来源', async () => {
  assert.throws(() =>
    parseSavedState({
      schemaVersion: 1,
      preferences: { weekStartsOn: 4, appearance: 'dark' },
      datasets: [],
    }),
  );
  let opened = false;
  const { controller } = fixture({
    openExternal: async () => {
      opened = true;
    },
  });
  await controller.openSource('javascript:alert(1)');
  assert.equal(opened, false);
});

test('黄历与所选日期同步，未收录调休仍可查看，设置返回保留日期', async () => {
  const { controller, saves } = fixture();
  await controller.initialize();
  controller.selectDate('2026-12-01');
  assert.deepEqual(controller.getSnapshot().almanac.ganZhi, {
    year: '丙午',
    month: '己亥',
    day: '己酉',
  });
  controller.showSettings();
  assert.equal(controller.getSnapshot().panel, 'settings');
  controller.showSettings(false);
  assert.equal(controller.getSnapshot().selected.date, '2026-12-01');
  controller.moveSelection(1);
  assert.equal(controller.getSnapshot().almanac.date, '2026-12-02');
  assert.equal(controller.getSnapshot().almanac.ganZhi.day, '庚戌');
  controller.selectDate('2028-01-01');
  assert.equal(controller.getSnapshot().selected.schedule.coverage, 'unavailable');
  assert.equal(controller.getSnapshot().almanac.date, '2028-01-01');
  assert.ok(controller.getSnapshot().almanac.yi.length > 0);
  assert.equal(saves.length, 0);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundledHolidayDatasets } from '../src/data.js';
import {
  CalendarEngine,
  HolidayStore,
  addDays,
  dateForInstant,
  daysBetween,
  getIsoWeek,
  parseDate,
  parseHolidayDataset,
} from '../src/index.js';

const engine = () => new CalendarEngine(new HolidayStore(bundledHolidayDatasets));

test('2026 春节、无三十的除夕和年界：节日规则不写死腊月三十', () => {
  const calendar = engine();
  const eve = calendar.getDay('2026-02-16');
  assert.equal(eve.lunar.day, 29);
  assert.ok(eve.festivals.includes('除夕'));
  const first = calendar.getDay('2026-02-17');
  assert.deepEqual([first.lunar.year, first.lunar.month, first.lunar.day], [2026, 1, 1]);
  assert.ok(first.festivals.includes('春节'));
});

test('2025 闰六月与 2033 闰冬月，月数和闰月标识分离', () => {
  const calendar = engine();
  assert.deepEqual(
    [calendar.getDay('2025-07-25').lunar.month, calendar.getDay('2025-07-25').lunar.isLeapMonth],
    [6, true],
  );
  assert.deepEqual(
    [calendar.getDay('2033-12-22').lunar.month, calendar.getDay('2033-12-22').lunar.isLeapMonth],
    [11, true],
  );
  assert.ok(!calendar.getDay('2023-03-23').festivals.includes('龙抬头'));
});

test('官方补班优先于周末，普通周末不标成节假日', () => {
  const calendar = engine();
  assert.equal(calendar.getDay('2026-02-14').schedule.kind, 'makeup-workday');
  assert.equal(calendar.getDay('2026-02-15').schedule.kind, 'holiday');
  assert.equal(calendar.getDay('2026-11-14').schedule.kind, 'weekend');
  assert.equal(calendar.getDay('2026-11-11').schedule.kind, 'weekday');
});

test('未收录的年份明确报告 unavailable，农历仍然可以离线查询', () => {
  const calendar = engine();
  const day = calendar.getDay('2028-01-01');
  assert.equal(day.schedule.coverage, 'unavailable');
  assert.ok(day.festivals.includes('元旦'));
  assert.equal(calendar.getMonth(2028, 1).coverage, 'unavailable');
});

test('2027 调休和未来跨年查询', () => {
  const calendar = engine();
  assert.equal(calendar.getDay('2027-01-31').schedule.kind, 'makeup-workday');
  assert.equal(calendar.getDay('2027-02-14').schedule.kind, 'makeup-workday');
  assert.deepEqual(calendar.getVacations('2026-11-11', 1), [
    { name: '元旦', start: '2027-01-01', end: '2027-01-03', days: 3, daysUntil: 51 },
  ]);
});

test('端午节连休周末不一定列在上游数据，假期须延伸至普通周末', () => {
  const calendar = engine();
  assert.equal(calendar.getVacations('2026-06-18', 1)[0]?.end, '2026-06-21');
  assert.equal(calendar.getVacations('2026-06-18', 1)[0]?.days, 3);
});

test('清明同时是节气和节日；后续节气按日期排序', () => {
  const calendar = engine();
  const day = calendar.getDay('2026-04-05');
  assert.equal(day.solarTerm, '清明');
  assert.ok(day.festivals.includes('清明节'));
  const events = calendar.getUpcoming('2026-11-11', { days: 30, kind: 'solar-term' });
  assert.equal(events[0]?.name, '小雪');
  assert.equal(events[0]?.date, '2026-11-22');
});

test('严格日期校验、闰年、日期运算和显式时区', () => {
  assert.throws(() => parseDate('2026-02-29'));
  assert.throws(() => parseDate('2026-13-01'));
  assert.throws(() => parseDate('2026-2-01'));
  assert.throws(() => parseDate('1900-01-01'));
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(dateForInstant(new Date('2026-11-10T16:30:00Z')), '2026-11-11');
  assert.equal(
    dateForInstant(new Date('2026-11-10T16:30:00Z'), 'America/Los_Angeles'),
    '2026-11-10',
  );
});

test('ISO 周按周一切换，跨年时使用周所属年份', () => {
  assert.deepEqual(getIsoWeek('2026-11-20'), { year: 2026, week: 47 });
  assert.deepEqual(getIsoWeek('2026-11-22'), { year: 2026, week: 47 });
  assert.deepEqual(getIsoWeek('2026-11-23'), { year: 2026, week: 48 });
  assert.deepEqual(getIsoWeek('2027-01-03'), { year: 2026, week: 53 });
  assert.deepEqual(getIsoWeek('2027-01-04'), { year: 2027, week: 1 });
  assert.deepEqual(getIsoWeek('2024-12-30'), { year: 2025, week: 1 });
});

test('月历周一/周日起始、跨月六行、支持范围两端不溢出', () => {
  const calendar = engine();
  assert.equal(calendar.getMonth(2026, 11).cells.length, 42);
  assert.equal(calendar.getMonth(2026, 11).cells[0]?.date, '2026-10-26');
  assert.equal(calendar.getMonth(2026, 11, 7).cells[0]?.date, '2026-11-01');
  assert.equal(calendar.getMonth(1901, 1).cells[0], null);
  assert.equal(calendar.getMonth(2100, 12).cells.at(-1), null);
});

test('不可信调休数据先验证；导入失败保留旧数据', () => {
  const store = new HolidayStore(bundledHolidayDatasets);
  assert.throws(() => store.import({ year: 2026, papers: ['javascript:alert(1)'], days: [] }));
  assert.equal(store.get('2026-02-14').kind, 'makeup-workday');
  assert.throws(() =>
    parseHolidayDataset({
      year: 2028,
      papers: ['https://example.com'],
      days: [{ date: '2028-01-01', name: '元旦', isOffDay: 'false' }],
    }),
  );
  assert.throws(() =>
    parseHolidayDataset({
      year: 2028,
      papers: ['https://example.com'],
      days: [{ date: '2028-02-30', name: '元旦', isOffDay: true }],
    }),
  );
});

test('下一年通知覆盖前一年十二月；本年常规日期仍按本年覆盖状态判断', () => {
  const store = new HolidayStore([
    {
      year: 2027,
      papers: ['https://example.com/notice'],
      days: [{ date: '2026-12-31', name: '元旦', isOffDay: true }],
    },
  ]);
  assert.equal(store.get('2026-12-31').kind, 'holiday');
  assert.equal(store.get('2026-12-30').coverage, 'unavailable');
});

test('核心输出可 JSON 序列化且调用方无法污染缓存或调休源', () => {
  const calendar = engine();
  const first = calendar.getDay('2026-02-17');
  first.festivals.length = 0;
  first.lunar.day = 100;
  first.schedule.sources.length = 0;
  const next = JSON.parse(JSON.stringify(calendar.getDay('2026-02-17')));
  assert.equal(next.lunar.day, 1);
  assert.ok(next.festivals.includes('春节'));
  assert.ok(next.schedule.sources.length > 0);
  const exported = calendar.holidays.export();
  exported[0]!.days.length = 0;
  assert.ok(calendar.holidays.export()[0]!.days.length > 0);
});

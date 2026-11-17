import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundledHolidayDatasets } from '../src/data.js';
import { addDays, countWorkdays, daysBetween, HolidayStore } from '../src/index.js';

const holidays = new HolidayStore(bundledHolidayDatasets);

test('日期间隔支持相同日期、反向日期、跨年与闰年，不依赖时区', () => {
  assert.equal(daysBetween('2026-11-17', '2026-11-17'), 0);
  assert.equal(daysBetween('2026-11-18', '2026-11-17'), -1);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysBetween('2100-02-28', '2100-03-01'), 1);
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
});

test('日期推算支持前后和零天，严格拒绝小数、无效日期及范围溢出', () => {
  assert.equal(addDays('2026-11-17', 100), '2027-02-25');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2026-11-17', 0), '2026-11-17');
  for (const amount of [0.5, NaN, Infinity]) {
    assert.throws(() => addDays('2026-11-17', amount), RangeError);
  }
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
  assert.throws(() => addDays('1901-01-01', -1), RangeError);
  assert.throws(() => addDays('2100-12-31', 1), RangeError);
});

test('工作日默认不计起始日且计结束日，普通周末与补班分开计算', () => {
  assert.deepEqual(countWorkdays('2026-11-13', '2026-11-16', holidays), {
    coverage: 'published',
    days: 1,
    missingYears: [],
  });
  assert.equal(countWorkdays('2026-11-13', '2026-11-16', holidays, true).days, 2);
  assert.equal(countWorkdays('2026-02-13', '2026-02-14', holidays).days, 1);
  assert.equal(countWorkdays('2026-02-14', '2026-02-23', holidays).days, 0);
  assert.equal(countWorkdays('2026-02-14', '2026-02-23', holidays, true).days, 1);
});

test('同日按是否计入起始日处理，不查询空区间中的未知调休', () => {
  assert.equal(countWorkdays('2026-11-17', '2026-11-17', holidays).days, 0);
  assert.equal(countWorkdays('2026-11-17', '2026-11-17', holidays, true).days, 1);
  assert.equal(countWorkdays('2026-11-15', '2026-11-15', holidays, true).days, 0);
  assert.equal(countWorkdays('2028-01-01', '2028-01-01', holidays).days, 0);
  assert.deepEqual(countWorkdays('2028-01-01', '2028-01-01', holidays, true), {
    coverage: 'unavailable',
    days: null,
    missingYears: [2028],
  });
});

test('跨年工作日包含元旦安排；缺少任一年时不暴露部分计数', () => {
  assert.equal(countWorkdays('2026-12-31', '2027-01-04', holidays).days, 1);
  assert.deepEqual(countWorkdays('2027-12-30', '2029-01-02', holidays), {
    coverage: 'unavailable',
    days: null,
    missingYears: [2028, 2029],
  });
});

test('下一年通知覆盖的前一年十二月可参与计算，但不能推断其余日期', () => {
  const store = new HolidayStore([
    {
      year: 2027,
      papers: ['https://example.com/notice'],
      days: [{ date: '2026-12-31', name: '元旦', isOffDay: true }],
    },
  ]);
  assert.equal(countWorkdays('2026-12-30', '2026-12-31', store).days, 0);
  assert.deepEqual(countWorkdays('2026-12-30', '2026-12-31', store, true), {
    coverage: 'unavailable',
    days: null,
    missingYears: [2026],
  });
});

test('工作日计算严格校验日期、顺序，且支持范围边界', () => {
  assert.throws(() => countWorkdays('2026-11-18', '2026-11-17', holidays), /早于/);
  assert.throws(() => countWorkdays('2026-02-30', '2026-03-01', holidays), RangeError);
  assert.throws(() => countWorkdays('1900-12-31', '1901-01-01', holidays), RangeError);
  assert.equal(countWorkdays('2100-12-31', '2100-12-31', holidays).days, 0);
  assert.deepEqual(countWorkdays('1901-01-01', '2100-12-31', new HolidayStore()), {
    coverage: 'unavailable',
    days: null,
    missingYears: Array.from({ length: 200 }, (_, index) => 1901 + index),
  });
});

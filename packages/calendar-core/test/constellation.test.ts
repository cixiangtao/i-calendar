import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CalendarEngine, addDays } from '../src/index.js';

test('十二星座固定月日区间：换座日和前一天分别归属正确', () => {
  const calendar = new CalendarEngine();
  const boundaries = [
    ['01-20', '水瓶座', '摩羯座'],
    ['02-19', '双鱼座', '水瓶座'],
    ['03-21', '白羊座', '双鱼座'],
    ['04-20', '金牛座', '白羊座'],
    ['05-21', '双子座', '金牛座'],
    ['06-22', '巨蟹座', '双子座'],
    ['07-23', '狮子座', '巨蟹座'],
    ['08-23', '处女座', '狮子座'],
    ['09-23', '天秤座', '处女座'],
    ['10-24', '天蝎座', '天秤座'],
    ['11-23', '射手座', '天蝎座'],
    ['12-22', '摩羯座', '射手座'],
  ];
  for (const [monthDay, current, previous] of boundaries) {
    const date = `2026-${monthDay}`;
    assert.equal(calendar.getDay(date).constellation, current, date);
    assert.equal(calendar.getDay(addDays(date, -1)).constellation, previous, date);
  }
});

test('生肖按春节换年，与公历年界、立春和星座分开', () => {
  const calendar = new CalendarEngine();
  assert.equal(calendar.getDay('2026-01-01').lunar.zodiac, '蛇');
  assert.equal(calendar.getDay('2026-02-04').lunar.zodiac, '蛇');
  assert.equal(calendar.getDay('2026-02-16').lunar.zodiac, '蛇');
  assert.equal(calendar.getDay('2026-02-17').lunar.zodiac, '马');
  const sample = calendar.getDay('2026-11-12');
  assert.equal(sample.lunar.zodiac, '马');
  assert.equal(sample.constellation, '天蝎座');
  assert.equal(calendar.getDay('2027-01-01').lunar.zodiac, '马');
});

test('星座在闰日、跨年与支持边界可查，不依赖调休且可序列化', () => {
  const calendar = new CalendarEngine();
  for (const date of ['1901-01-01', '2026-12-31', '2027-01-01', '2100-12-31'])
    assert.equal(calendar.getDay(date).constellation, '摩羯座');
  assert.equal(calendar.getDay('2024-02-29').constellation, '双鱼座');
  const day = calendar.getDay('2028-11-12');
  assert.equal(day.schedule.coverage, 'unavailable');
  assert.equal(JSON.parse(JSON.stringify(day)).constellation, '天蝎座');
  day.constellation = '篡改值';
  assert.equal(calendar.getDay('2028-11-12').constellation, '天蝎座');
});

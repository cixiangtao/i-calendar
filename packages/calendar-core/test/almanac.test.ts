import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ALMANAC_SOURCE, CalendarEngine, getAlmanac, HolidayStore } from '../src/index.js';

// 与用户参考图 2026-12-01 的干支、宜忌及主要方位交叉核对的固定样例。
test('黄历样例：年月日干支、完整宜忌、冲煞及福神流派固定', () => {
  const day = getAlmanac('2026-12-01');
  assert.equal(day.rules.id, 'i-calendar-almanac-v1');
  assert.deepEqual(day.ganZhi, { year: '丙午', month: '己亥', day: '己酉' });
  assert.deepEqual(day.yi, [
    '开市',
    '纳财',
    '出行',
    '祭祀',
    '祈福',
    '求嗣',
    '斋醮',
    '问名',
    '入学',
    '起基',
    '定磉',
    '置产',
    '开渠',
    '掘井',
    '拆卸',
    '栽种',
    '纳畜',
    '牧养',
    '动土',
    '破土',
    '启钻',
  ]);
  assert.deepEqual(day.ji, ['移徙', '入宅', '出火', '入殓', '安葬']);
  assert.equal(day.chong, '(癸卯)兔');
  assert.equal(day.sha, '东');
  assert.equal(day.positions.xi, '东北');
  assert.equal(day.positions.cai, '正北');
  assert.equal(day.positions.fu, '正南');
  assert.equal(day.rules.fuSect, 1);
  assert.equal(day.rules.yiJiSect, 1);
});

test('年干支按春节切换，月干支按节交接日切换，两种边界不混用', () => {
  assert.deepEqual(getAlmanac('2026-02-03').ganZhi, { year: '乙巳', month: '己丑', day: '戊申' });
  assert.deepEqual(getAlmanac('2026-02-04').ganZhi, { year: '乙巳', month: '庚寅', day: '己酉' });
  assert.equal(getAlmanac('2026-02-16').ganZhi.year, '乙巳');
  assert.equal(getAlmanac('2026-02-17').ganZhi.year, '丙午');
  assert.equal(getAlmanac('2026-02-17').ganZhi.month, '庚寅');
});

test('黄历查询覆盖产品日期边界并拒绝无效日期和时间戳', () => {
  assert.equal(getAlmanac('1901-01-01').ganZhi.day, '己卯');
  assert.equal(getAlmanac('2100-12-31').ganZhi.day, '丁未');
  for (const date of ['1900-12-31', '2101-01-01', '2026-02-29', '2026-12-01T23:00:00+08:00']) {
    assert.throws(() => getAlmanac(date), RangeError);
  }
});

test('返回数据可序列化，调用方修改结果不污染后续查询及规则来源', () => {
  const first = getAlmanac('2026-12-01');
  const expected = structuredClone(first);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), expected);
  first.yi.length = 0;
  first.ji.push('测试');
  first.positions.fu = '测试';
  first.source.version = '测试';
  assert.deepEqual(getAlmanac('2026-12-01'), expected);
});

test('黄历不依赖调休覆盖，月历结果保持轻量', () => {
  const engine = new CalendarEngine(new HolidayStore());
  assert.equal(engine.getDay('2026-12-01').schedule.coverage, 'unavailable');
  assert.deepEqual(engine.getAlmanac('2026-12-01'), getAlmanac('2026-12-01'));
  assert.ok(engine.getMonth(2026, 12).cells.every((day) => day === null || !('almanac' in day)));
});

test('数据来源中的库版本与实际依赖保持一致，防止升级后口径失去追溯', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(ALMANAC_SOURCE.version, manifest.dependencies['lunar-typescript']);
});

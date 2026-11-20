import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateFortuneV2 } from 'acer-almanac';

import { createDailySign } from '../src/daily-sign-content.js';

const date = { year: 2026, month: 11, day: 20 };
const firstSeed = '24d048f737ff47e9893896387677d601';
const secondSeed = '737e06916f554ae5be8d6cc8ad37e4f3';

test('每日签保留 acer 的全部宜忌事项原名和顺序', () => {
  const { good, bad } = generateFortuneV2(date, firstSeed);
  const sign = createDailySign(date, firstSeed);

  assert.deepEqual(
    sign.good,
    good.map(({ activity }) => activity),
  );
  assert.deepEqual(
    sign.bad,
    bad.map(({ activity }) => activity),
  );
  assert.equal(
    sign.rank,
    good.length > bad.length ? '上签' : good.length < bad.length ? '下签' : '中签',
  );
});

test('同一天和同一抽签种子可以复现，独立种子生成不同签文', () => {
  const first = createDailySign(date, firstSeed);
  assert.deepEqual(createDailySign(date, firstSeed), first);
  assert.notDeepEqual(createDailySign(date, secondSeed), first);
});

test('Acer 调用不传抽签种子时仍沿用原结果', () => {
  const { good, bad } = generateFortuneV2(date);
  assert.equal(good.length, 4);
  assert.equal(bad.length, 3);
});

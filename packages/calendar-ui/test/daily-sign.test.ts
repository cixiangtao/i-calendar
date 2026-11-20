import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateFortuneV2 } from 'acer-almanac';

import { createDailySign } from '../src/daily-sign-content.js';

test('每日签保留 acer 的全部宜忌事项原名和顺序', () => {
  const date = { year: 2026, month: 11, day: 20 };
  const { good, bad } = generateFortuneV2(date);
  const sign = createDailySign(date);

  assert.equal(good.length, 4);
  assert.equal(bad.length, 3);
  assert.deepEqual(
    sign.good,
    good.map(({ activity }) => activity),
  );
  assert.deepEqual(
    sign.bad,
    bad.map(({ activity }) => activity),
  );
});

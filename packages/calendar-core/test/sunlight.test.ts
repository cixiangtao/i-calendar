import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import { sunlightPlaces, nearestSunlightPlace } from '../src/places.js';
import { getSunlight } from '../src/sunlight.js';

const beijing = { latitude: 39.9, longitude: 116.4 };
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

test('北京夏至与 USNO 独立参考值相符，冬季白昼更短', () => {
  // USNO 公开接口，2026-06-21，39.9N/116.4E，UTC+8：日出04:46、日落19:46。
  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-06-21&coords=39.9,116.4&tz=8
  const summer = getSunlight('2026-06-21', beijing);
  const winter = getSunlight('2026-12-21', beijing);
  assert.ok(Math.abs(minutes(summer.sunrise!) - minutes('04:46')) <= 2);
  assert.ok(Math.abs(minutes(summer.sunset!) - minutes('19:46')) <= 2);
  assert.ok(summer.daylightMinutes > 890 && summer.daylightMinutes < 910);
  assert.ok(winter.daylightMinutes < 570);
});

test('同一城市范围内经度改变实际影响时间，不归并为城市中心', () => {
  const west = getSunlight('2026-03-20', { latitude: 30, longitude: 106 });
  const east = getSunlight('2026-03-20', { latitude: 30, longitude: 110 });
  assert.ok(minutes(west.sunrise!) - minutes(east.sunrise!) >= 15);
  assert.ok(minutes(west.sunset!) - minutes(east.sunset!) >= 15);
});

test('设备时区不改变北京时间结果，包含设备夏令时与跨日场景', () => {
  const code =
    'import {getSunlight} from "./packages/calendar-core/src/sunlight.ts"; console.log(JSON.stringify(getSunlight("2026-06-21",{latitude:39.9,longitude:116.4})))';
  const results = ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland'].map((TZ) =>
    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      encoding: 'utf8',
      env: { ...process.env, TZ },
    }).trim(),
  );
  assert.equal(new Set(results).size, 1);
});

test('国内东西南北边缘、闰日和日期边界返回有限结果', () => {
  for (const date of ['1901-01-01', '2028-02-29', '2100-12-31']) {
    for (const point of [
      { latitude: 53.48, longitude: 122.35 },
      { latitude: 22.2, longitude: 113.5 },
      { latitude: 39.47, longitude: 75.99 },
    ]) {
      const result = getSunlight(date, point);
      assert.match(result.sunrise!, /^\d{2}:\d{2}$/);
      assert.match(result.sunset!, /^\d{2}:\d{2}$/);
      assert.ok(result.daylightMinutes > 0 && result.daylightMinutes <= 1440);
    }
  }
});

test('极昼极夜不输出无效时间，明确返回全天或零白昼', () => {
  const point = { latitude: 80, longitude: 120 };
  const summer = getSunlight('2026-06-21', point);
  const winter = getSunlight('2026-12-21', point);
  assert.deepEqual(
    [summer.sunrise, summer.sunset, summer.daylightMinutes, summer.condition],
    [null, null, 1440, 'polar-day'],
  );
  assert.deepEqual(
    [winter.sunrise, winter.sunset, winter.daylightMinutes, winter.condition],
    [null, null, 0, 'polar-night'],
  );
});

test('非法日期、坐标及非有限输入明确拒绝', () => {
  assert.throws(() => getSunlight('2026-02-30', beijing));
  for (const latitude of [91, -91, NaN, Infinity])
    assert.throws(() => getSunlight('2026-11-17', { latitude, longitude: 116.4 }));
  assert.throws(() => getSunlight('2026-11-17', { latitude: 30, longitude: 181 }));
});

test('国内地点快照标识唯一，坐标有效，并有主要城市；附近提示不改输入坐标', () => {
  assert.equal(new Set(sunlightPlaces.map((place) => place.id)).size, sunlightPlaces.length);
  for (const place of sunlightPlaces) {
    assert.ok(Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90);
    assert.ok(Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180);
    assert.ok(place.name && place.region);
  }
  assert.ok(sunlightPlaces.some((place) => place.name === '北京市'));
  const point = { ...beijing };
  assert.ok(nearestSunlightPlace(point));
  assert.deepEqual(point, beijing);
  assert.equal(nearestSunlightPlace({ latitude: 0, longitude: 0 }), null);
});

import { getTimes } from 'suncalc';

import { parseDate } from './date.js';
import type { DateKey } from './types.js';

/** WGS84 十进制度坐标；经纬度不使用国内地图的偏移坐标。 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** 固定北京时间的日出日落；空事件表示该日期没有对应的升落。 */
export interface SunlightDay {
  date: DateKey;
  sunrise: string | null;
  sunset: string | null;
  /** 当日北京时间零点至次日零点之间的日照分钟数。 */
  daylightMinutes: number;
  condition: 'normal' | 'polar-day' | 'polar-night' | 'partial';
  rule: 'suncalc-2.1.1-beijing-v1';
}

/** 校验坐标范围，拒绝 NaN、无穷值和颠倒后超界的坐标。 */
export function validCoordinates(point: Coordinates) {
  return (
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}

function formatSunlightTime(value: number | null) {
  if (value === null) return null;
  // 以分钟显示，截断秒，避免 23:59:xx 四舍五入为次日零点。
  return new Date(value + 28_800_000).toISOString().slice(11, 16);
}

/**
 * 按选定公历日与实际坐标离线计算，始终使用 UTC+8，不随设备时区或历史夏令时改变。 日出日落采用太阳上缘经过理想地平线的口径（标准折射、观察高度为零）；
 * 不将设备海拔当作高于地平线的观察高度，不预测山体、建筑与天气遮挡。
 */
export function getSunlight(date: DateKey, point: Coordinates): SunlightDay {
  parseDate(date);
  if (!validCoordinates(point)) throw new RangeError('经纬度无效');
  const start = Date.parse(`${date}T00:00:00+08:00`);
  const end = start + 86_400_000;
  const times = getTimes(new Date(start + 43_200_000), point.latitude, point.longitude, 0, 480);
  const event = (value: Date | null) => {
    const time = value?.getTime();
    return time !== undefined && Number.isFinite(time) && time >= start && time < end ? time : null;
  };
  const sunrise = event(times.sunrise);
  const sunset = event(times.sunset);
  let daylight = 0;
  if (times.alwaysUp) daylight = end - start;
  else if (sunrise !== null && sunset !== null) {
    daylight = sunset >= sunrise ? sunset - sunrise : end - sunrise + sunset - start;
  } else if (sunrise !== null) daylight = end - sunrise;
  else if (sunset !== null) daylight = sunset - start;
  return {
    date,
    sunrise: formatSunlightTime(sunrise),
    sunset: formatSunlightTime(sunset),
    daylightMinutes: Math.round(daylight / 60_000),
    condition: times.alwaysUp
      ? 'polar-day'
      : times.alwaysDown
        ? 'polar-night'
        : sunrise !== null && sunset !== null
          ? 'normal'
          : 'partial',
    rule: 'suncalc-2.1.1-beijing-v1',
  };
}

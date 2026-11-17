import places from './data/china-places.json';
import type { Coordinates } from './sunlight.js';

/** 国内城市及部分区县的参考点；不是行政区边界或实时定位结果。 */
export interface SunlightPlace extends Coordinates {
  id: string;
  name: string;
  region: string;
}

/** GeoNames 快照，仅在选择地点或为定位补充附近地名时按需载入。 */
export const sunlightPlaces: readonly SunlightPlace[] = places;

/** 仅供地名提示，调用方必须标注“附近”，计算仍使用传入的实际坐标。 */
export function nearestSunlightPlace(point: Coordinates): SunlightPlace | null {
  const radians = Math.PI / 180;
  let best: SunlightPlace | null = null;
  let minimum = Infinity;
  for (const place of sunlightPlaces) {
    const a =
      Math.sin(((place.latitude - point.latitude) * radians) / 2) ** 2 +
      Math.cos(point.latitude * radians) *
        Math.cos(place.latitude * radians) *
        Math.sin(((place.longitude - point.longitude) * radians) / 2) ** 2;
    if (a < minimum) {
      minimum = a;
      best = place;
    }
  }
  // 不为境外或远离参考点的坐标伪造国内地名（约 100 公里上限）。
  return minimum <= Math.sin(100 / (2 * 6371)) ** 2 ? best : null;
}

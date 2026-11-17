import { validCoordinates, type Coordinates } from '@i-calendar/core';

/** 用户明确选择的国内参考点可持久化；系统定位坐标仅保留在本次会话内。 */
export interface ManualSunlightLocation extends Coordinates {
  id: string;
  name: string;
  region: string;
}

export interface SunlightPreferences {
  mode: 'off' | 'manual' | 'automatic';
  manualLocation: ManualSunlightLocation | null;
}

/** 系统定位结果，accuracy 单位米，timestamp 为 Unix 毫秒；地名解析可选。 */
export interface LocatedPoint extends Coordinates {
  accuracy: number;
  timestamp: number;
  label?: string;
}

export interface SunlightLocationState {
  pending: boolean;
  point: LocatedPoint | null;
  error: string | null;
}

/** 旧版偏好默认关闭定位，不因升级弹出系统权限请求。 */
export function parseSunlightPreferences(value: unknown): SunlightPreferences {
  if (value === undefined) return { mode: 'off', manualLocation: null };
  if (
    !value ||
    typeof value !== 'object' ||
    !('mode' in value) ||
    !('manualLocation' in value) ||
    !['off', 'manual', 'automatic'].includes(String(value.mode))
  )
    throw new Error('日出日落设置无效');
  const point = value.manualLocation;
  let manualLocation: ManualSunlightLocation | null = null;
  if (point !== null) {
    if (
      !point ||
      typeof point !== 'object' ||
      !('latitude' in point) ||
      !('longitude' in point) ||
      !('id' in point) ||
      !('name' in point) ||
      !('region' in point) ||
      typeof point.latitude !== 'number' ||
      typeof point.longitude !== 'number' ||
      !validCoordinates({ latitude: point.latitude, longitude: point.longitude }) ||
      typeof point.id !== 'string' ||
      !/^\d{1,12}$/.test(point.id) ||
      typeof point.name !== 'string' ||
      !point.name.trim() ||
      point.name.length > 64 ||
      typeof point.region !== 'string' ||
      !point.region.trim() ||
      point.region.length > 32
    )
      throw new Error('日出日落地点无效');
    manualLocation = {
      id: point.id,
      name: point.name,
      region: point.region,
      latitude: point.latitude,
      longitude: point.longitude,
    };
  }
  if (value.mode === 'manual' && !manualLocation) throw new Error('请选择日出日落地点');
  return { mode: value.mode as SunlightPreferences['mode'], manualLocation };
}

/** 不接受无效精度或过期系统缓存，避免把旧位置显示成新定位。 */
export function validLocatedPoint(point: LocatedPoint, now: number) {
  return (
    validCoordinates(point) &&
    Number.isFinite(point.accuracy) &&
    point.accuracy >= 0 &&
    Number.isFinite(point.timestamp) &&
    point.timestamp >= now - 120_000 &&
    point.timestamp <= now + 60_000 &&
    (point.label === undefined || (typeof point.label === 'string' && point.label.length <= 100))
  );
}

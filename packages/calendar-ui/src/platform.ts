import type { HolidayDataset } from '@i-calendar/core';

import type { AppUpdater } from './app-update.js';
import type { ColorThemeId, CustomColors } from './color-theme.js';
import type { LaunchAtLogin } from './launch-at-login.js';
import type { MenuClockPreferences } from './menu-clock.js';
import type { LocatedPoint, SunlightPreferences } from './sunlight-location.js';

/** 三端使用相同数据格式；存储、网络和窗口操作由宿主实现。 */
export interface CalendarPreferences {
  weekStartsOn: 1 | 7;
  appearance: 'system' | 'light' | 'dark';
  /** 是否展示月历之外的农历详情卡片，默认开启。 */
  showLunarDetails: boolean;
  colorTheme: ColorThemeId;
  /** Null 使用主题默认强调色；自定义值为 #RRGGBB。 */
  accentColor: string | null;
  /** 高级配色按浅深色保存主色，派生颜色由主题生成；关闭时保留选色。 */
  customColors: CustomColors;
  menuClock: MenuClockPreferences;
  /** 正式 Mac 构建后台检查应用版本；安装仍需用户确认。 */
  automaticAppUpdates: boolean;
  sunlight: SunlightPreferences;
}

/** 持久化格式显式版本化，避免以后升级时误读缓存。 */
export interface SavedCalendarState {
  schemaVersion: 1;
  preferences: CalendarPreferences;
  datasets: HolidayDataset[];
  updatedAt?: string;
}

/** 界面只依赖此契约，不直接导入 Tauri、文件系统或浏览器存储。 */
export interface CalendarPlatform {
  kind: 'web' | 'macos' | 'ios';
  load(): Promise<unknown>;
  save(state: SavedCalendarState): Promise<void>;
  fetchHolidayYear(year: number, signal: AbortSignal): Promise<unknown | null>;
  openExternal(url: string): Promise<void>;
  copyText(text: string): Promise<void>;
  /** 一次性高精度定位；仅由明确启用的位置功能调用，取消时停止宿主请求。 */
  locate?(signal: AbortSignal, requestPermission: boolean): Promise<LocatedPoint>;
  /** 仅 Mac 提供，打开固定的系统定位权限面板。 */
  openLocationSettings?(): Promise<void>;
  setInteractionBusy?(busy: boolean): Promise<void>;
  /** 请求悬浮窗内容高度（逻辑像素）；宿主按当前屏幕可用空间裁切。 */
  setPopupHeight?(height: number): Promise<void>;
  close?(): Promise<void>;
  quit?(): Promise<void>;
  /** 只有已配置签名更新源的正式 Mac 构建提供此能力。 */
  appUpdater?: AppUpdater;
  /** 仅实际 Mac 应用提供，系统注册状态不随导入导出的日历偏好迁移。 */
  launchAtLogin?: LaunchAtLogin;
}

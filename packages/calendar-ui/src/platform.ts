import type { HolidayDataset } from '@shiri/calendar-core';

/** 三端使用相同数据格式；存储、网络和窗口操作由宿主实现。 */
export interface CalendarPreferences {
  weekStartsOn: 1 | 7;
  appearance: 'system' | 'light' | 'dark';
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
  setInteractionBusy?(busy: boolean): Promise<void>;
  close?(): Promise<void>;
  quit?(): Promise<void>;
}

import y2025 from './data/2025.json';
import y2026 from './data/2026.json';
import y2027 from './data/2027.json';
import type { HolidayDataset } from './types.js';

/** Offline snapshot from holiday-cn. See third-party notices and source papers in each year. */
export const bundledHolidayDatasets: readonly HolidayDataset[] = [y2025, y2026, y2027];
export const HOLIDAY_SNAPSHOT_VERSION = '2026-11-11';

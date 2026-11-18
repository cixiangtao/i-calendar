import {
  CalendarEngine,
  HolidayStore,
  addDays,
  dateForInstant,
  parseHolidayDataset,
  type CalendarDay,
  type DayAlmanac,
  type HolidayDataset,
  type MonthCalendar,
} from '@i-calendar/core';
import { bundledHolidayDatasets } from '@i-calendar/core/data';

import { AppUpdateController } from './app-update.js';
import { LaunchAtLoginController } from './launch-at-login.js';
import { defaultMenuClock, parseMenuClock } from './menu-clock.js';
import type { CalendarPlatform, CalendarPreferences, SavedCalendarState } from './platform.js';
import {
  parseSunlightPreferences,
  LocationRequestError,
  validLocatedPoint,
  validLastKnownPoint,
  type ManualSunlightLocation,
  type SunlightLocationState,
} from './sunlight-location.js';
import { migrateThemeLibrary, parseThemeLibrary } from './theme-library.js';

/** 可观察的应用快照；React、测试和宿主都读取同一状态。 */
export interface CalendarSnapshot {
  ready: boolean;
  today: string;
  year: number;
  monthNumber: number;
  selected: CalendarDay;
  almanac: DayAlmanac;
  month: MonthCalendar;
  preferences: CalendarPreferences;
  years: number[];
  panel: 'calendar' | 'settings' | 'calculator';
  settingsTab: 'general' | 'about';
  updating: boolean;
  error: string | null;
  notice: string | null;
  sunlightLocation: SunlightLocationState;
  updatedAt?: string;
}

const defaults: CalendarPreferences = {
  weekStartsOn: 1,
  appearance: 'system',
  showLunarDetails: true,
  themes: migrateThemeLibrary({}),
  menuClock: { ...defaultMenuClock },
  automaticAppUpdates: true,
  sunlight: parseSunlightPreferences(undefined),
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 验证持久化数据；校验失败时由宿主保留原文件，界面回退内置数据。 */
export function parseSavedState(input: unknown): SavedCalendarState {
  if (
    !isRecord(input) ||
    input.schemaVersion !== 1 ||
    !isRecord(input.preferences) ||
    !Array.isArray(input.datasets) ||
    input.datasets.length > 200
  )
    throw new Error('本地数据格式不受支持');
  const { weekStartsOn, appearance } = input.preferences;
  const showLunarDetails =
    input.preferences.showLunarDetails === undefined
      ? defaults.showLunarDetails
      : input.preferences.showLunarDetails;
  const themes =
    input.preferences.themes === undefined
      ? migrateThemeLibrary(input.preferences)
      : parseThemeLibrary(input.preferences.themes);
  const menuClock = parseMenuClock(input.preferences.menuClock);
  const sunlight = parseSunlightPreferences(input.preferences.sunlight);
  const automaticAppUpdates =
    input.preferences.automaticAppUpdates === undefined
      ? defaults.automaticAppUpdates
      : input.preferences.automaticAppUpdates;
  if (
    (weekStartsOn !== 1 && weekStartsOn !== 7) ||
    !['system', 'light', 'dark'].includes(String(appearance)) ||
    typeof showLunarDetails !== 'boolean' ||
    typeof automaticAppUpdates !== 'boolean'
  )
    throw new Error('本地显示设置无效');
  const datasets = input.datasets.map(parseHolidayDataset);
  if (new Set(datasets.map((item) => item.year)).size !== datasets.length)
    throw new Error('本地调休包含重复年份');
  if (
    input.updatedAt !== undefined &&
    (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt)))
  )
    throw new Error('本地更新时间无效');
  return {
    schemaVersion: 1,
    preferences: {
      weekStartsOn,
      appearance: appearance as CalendarPreferences['appearance'],
      showLunarDetails,
      themes,
      menuClock,
      automaticAppUpdates,
      sunlight,
    },
    datasets,
    updatedAt: input.updatedAt as string | undefined,
  };
}

function mergeDatasets(current: readonly HolidayDataset[], incoming: readonly HolidayDataset[]) {
  return [...new Map([...current, ...incoming].map((item) => [item.year, item])).values()];
}

/** 三端共用的应用状态；平台差异只从 CalendarPlatform 注入。 */
export class CalendarController {
  readonly holidays = new HolidayStore(bundledHolidayDatasets);
  readonly engine = new CalendarEngine(this.holidays);
  private snapshot: CalendarSnapshot;
  private listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  private saves: Promise<void> = Promise.resolve();
  private updateAbort?: AbortController;
  private disposed = false;
  private saveFailed = false;
  private locationAbort?: AbortController;
  private locationAttempt = -Infinity;
  readonly appUpdates: AppUpdateController;
  readonly launchAtLogin: LaunchAtLoginController;

  constructor(
    readonly platform: CalendarPlatform,
    private now: () => Date = () => new Date(),
  ) {
    this.launchAtLogin = new LaunchAtLoginController(platform.launchAtLogin);
    this.appUpdates = new AppUpdateController(platform.appUpdater, now, async () => {
      let pending: Promise<void>;
      do {
        pending = this.saves;
        await pending;
      } while (pending !== this.saves);
      if (this.saveFailed) throw new Error('设置尚未保存');
    });
    const today = dateForInstant(now());
    const selected = this.engine.getDay(today);
    this.snapshot = {
      ready: false,
      today,
      year: selected.year,
      monthNumber: selected.month,
      selected,
      almanac: this.engine.getAlmanac(selected.date),
      month: this.engine.getMonth(selected.year, selected.month),
      preferences: {
        ...defaults,
        menuClock: { ...defaultMenuClock },
        themes: migrateThemeLibrary({}),
        sunlight: parseSunlightPreferences(undefined),
      },
      years: this.holidays.years,
      panel: 'calendar',
      settingsTab: 'general',
      updating: false,
      error: null,
      notice: null,
      sunlightLocation: { pending: false, point: null, error: null },
    };
  }

  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private patch(next: Partial<CalendarSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  /** StrictMode 重挂载也只加载一次；加载失败不会覆盖已有缓存。 */
  initialize() {
    this.initialization ??= this.load();
    return this.initialization;
  }

  private async load() {
    try {
      const input = await this.platform.load();
      if (this.disposed) return;
      if (input !== null && input !== undefined) {
        const saved = parseSavedState(input);
        this.holidays.replace(mergeDatasets(bundledHolidayDatasets, saved.datasets));
        this.patch({ preferences: saved.preferences, updatedAt: saved.updatedAt });
      }
      this.refresh();
    } catch {
      this.patch({ error: '本地数据读取失败，已使用内置数据。可在设置中重新导入。' });
    } finally {
      this.patch({ ready: true });
    }
  }

  private refresh() {
    const state = this.snapshot;
    this.patch({
      month: this.engine.getMonth(state.year, state.monthNumber, state.preferences.weekStartsOn),
      selected: this.engine.getDay(state.selected.date),
      almanac: this.engine.getAlmanac(state.selected.date),
      years: this.holidays.years,
    });
  }

  /** 刷新北京时间；跟随今天的选择跨午夜继续跟随，手动选择保留。 */
  refreshToday() {
    const today = dateForInstant(this.now());
    if (today === this.snapshot.today) return;
    const following = this.snapshot.selected.date === this.snapshot.today;
    this.patch({ today });
    if (following) this.selectDate(today);
  }

  selectDate(date: string) {
    const selected = this.engine.getDay(date);
    this.patch({
      selected,
      almanac: this.engine.getAlmanac(selected.date),
      year: selected.year,
      monthNumber: selected.month,
      month: this.engine.getMonth(
        selected.year,
        selected.month,
        this.snapshot.preferences.weekStartsOn,
      ),
    });
  }

  goToday() {
    this.refreshToday();
    this.selectDate(this.snapshot.today);
  }

  /** 保留所选日号，目标月不足该日时夹到月末。 */
  jump(year: number, month: number) {
    const calendar = this.engine.getMonth(year, month, this.snapshot.preferences.weekStartsOn);
    const dates = calendar.cells.filter(
      (day): day is CalendarDay => !!day && day.year === year && day.month === month,
    );
    const selected = dates.find((day) => day.day === this.snapshot.selected.day) ?? dates.at(-1);
    if (selected) this.selectDate(selected.date);
  }

  shiftMonth(amount: number) {
    const total = this.snapshot.year * 12 + this.snapshot.monthNumber - 1 + amount;
    const year = Math.floor(total / 12);
    if (year < 1901 || year > 2100) return;
    this.jump(year, (total % 12) + 1);
  }

  moveSelection(days: number) {
    try {
      this.selectDate(addDays(this.snapshot.selected.date, days));
    } catch {
      /* 日期边界保持原选择。 */
    }
  }

  selectWeekEdge(end: boolean) {
    const offset =
      (this.snapshot.selected.weekday - this.snapshot.preferences.weekStartsOn + 7) % 7;
    this.moveSelection((end ? 6 : 0) - offset);
  }

  showSettings(show = true, settingsTab: 'general' | 'about' = 'general') {
    this.patch({ panel: show ? 'settings' : 'calendar', settingsTab });
  }

  /** 日期计算仅切换视图，不写入偏好或更改所选日期。 */
  showCalculator(show = true) {
    this.patch({ panel: show ? 'calculator' : 'calendar' });
  }
  dismissError() {
    this.patch({ error: null, notice: null });
  }

  setPreferences(preferences: Partial<CalendarPreferences>) {
    const next = { ...this.snapshot.preferences, ...preferences };
    next.menuClock = parseMenuClock(next.menuClock);
    next.themes =
      preferences.themes === undefined
        ? this.snapshot.preferences.themes
        : parseThemeLibrary(preferences.themes);
    next.sunlight = parseSunlightPreferences(next.sunlight);
    if (
      (next.weekStartsOn !== 1 && next.weekStartsOn !== 7) ||
      !['system', 'light', 'dark'].includes(next.appearance) ||
      typeof next.showLunarDetails !== 'boolean' ||
      typeof next.automaticAppUpdates !== 'boolean'
    )
      throw new Error('显示设置无效');
    if (next.sunlight.mode !== this.snapshot.preferences.sunlight.mode) {
      this.locationAbort?.abort();
      this.locationAbort = undefined;
      this.locationAttempt = -Infinity;
      this.patch({ sunlightLocation: { pending: false, point: null, error: null } });
    }
    this.patch({ preferences: next });
    this.refresh();
    return this.persist();
  }

  private serialized(): SavedCalendarState {
    return {
      schemaVersion: 1,
      preferences: {
        ...this.snapshot.preferences,
        menuClock: { ...this.snapshot.preferences.menuClock },
        sunlight: parseSunlightPreferences(this.snapshot.preferences.sunlight),
      },
      datasets: this.holidays.export(),
      updatedAt: this.snapshot.updatedAt,
    };
  }

  /** 串行保存，避免快速切换设置时旧写入覆盖新状态。 */
  private persist() {
    const state = this.serialized();
    const result = this.saves.then(async () => {
      try {
        await this.platform.save(state);
        this.saveFailed = false;
        return true;
      } catch {
        this.saveFailed = true;
        this.patch({ error: '本地保存失败，本次操作仍在内存中。请检查存储空间或浏览器设置。' });
        return false;
      }
    });
    this.saves = result.then(() => {});
    return result;
  }

  async importDataset(text: string) {
    if (this.snapshot.updating) return;
    try {
      if (new TextEncoder().encode(text).byteLength > 1_000_000)
        throw new Error('文件过大，请选择年度调休 JSON');
      const dataset = parseHolidayDataset(JSON.parse(text));
      this.holidays.import(dataset);
      this.patch({
        error: null,
        notice: `已导入${dataset.year}年调休数据`,
        updatedAt: this.now().toISOString(),
      });
      this.refresh();
      await this.persist();
    } catch (error) {
      this.patch({ error: `导入失败：${error instanceof Error ? error.message : '文件格式无效'}` });
    }
  }

  async checkUpdates() {
    if (this.snapshot.updating || this.disposed) return;
    this.updateAbort = new AbortController();
    this.patch({ updating: true, error: null, notice: null });
    const year = Number(this.snapshot.today.slice(0, 4));
    const years = [year, year + 1].filter((item) => item <= 2100);
    try {
      const results = await Promise.allSettled(
        years.map(async (target) => {
          const data = await this.platform.fetchHolidayYear(target, this.updateAbort!.signal);
          if (data === null) return null;
          const dataset = parseHolidayDataset(data);
          if (dataset.year !== target) throw new Error('数据年份与请求不一致');
          return dataset;
        }),
      );
      if (this.disposed) return;
      const valid: HolidayDataset[] = [];
      const failed: number[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') failed.push(years[index]!);
        else if (result.value) valid.push(result.value);
      });
      if (valid.length) {
        this.holidays.replace(mergeDatasets(this.holidays.export(), valid));
        this.patch({
          updatedAt: this.now().toISOString(),
          notice: `已同步${valid.map((item) => item.year).join('、')}年调休数据`,
        });
        this.refresh();
        await this.persist();
      } else if (!failed.length) this.patch({ notice: '数据源尚未收录新的年度安排' });
      if (failed.length)
        this.patch({
          error: `${failed.join('、')}年更新失败，仍可使用已有数据，也可导入年度 JSON。`,
        });
    } finally {
      this.patch({ updating: false });
      this.updateAbort = undefined;
    }
  }

  async copySelected() {
    const { selected } = this.snapshot;
    try {
      await this.platform.copyText(
        `${selected.date} 农历${selected.lunar.monthName}${selected.lunar.dayName}`,
      );
      this.patch({ notice: '日期已复制', error: null });
    } catch {
      this.patch({ error: '复制失败，请在日期摘要中手动选取文本。' });
    }
  }

  async openSource(url: string) {
    try {
      if (new URL(url).protocol !== 'https:') throw new Error('来源链接须使用 HTTPS');
      await this.platform.openExternal(url);
    } catch {
      this.patch({ error: '来源链接无法打开，请稍后再试。' });
    }
  }

  reportError(message: string) {
    this.patch({ error: message });
  }

  /** 手动地点是参考点，选择后立即取消未完成的自动定位，迟到回调不会覆盖。 */
  selectSunlightPlace(place: ManualSunlightLocation) {
    return this.setPreferences({ sunlight: { mode: 'manual', manualLocation: place } });
  }

  /** 取消等待立即恢复操作，迟到的位置不能覆盖后续请求或手动选择。 */
  cancelSunlightLocation() {
    this.locationAbort?.abort();
    this.locationAbort = undefined;
    if (this.snapshot.sunlightLocation.pending)
      this.patch({ sunlightLocation: { pending: false, point: null, error: null } });
  }

  /** 用户确认仍在系统上次记录的地点后，才用该坐标计算本次会话的日照。 */
  confirmLastKnownLocation() {
    const { candidate } = this.snapshot.sunlightLocation;
    if (this.disposed || this.snapshot.preferences.sunlight.mode !== 'automatic' || !candidate)
      return;
    if (!validLastKnownPoint(candidate, this.now().getTime())) {
      this.patch({
        sunlightLocation: {
          pending: false,
          point: null,
          error: '上次位置已过期，请重新定位或选择城市',
        },
      });
      return;
    }
    this.patch({ sunlightLocation: { pending: false, point: candidate, error: null } });
  }

  /** 用户启用后仅在前台有界刷新；拒绝或失败后本次会话只允许主动重试。 */
  async locateSunlight(automatic = false) {
    if (this.disposed || !this.snapshot.ready || !this.platform.locate) return;
    if (
      automatic &&
      (this.snapshot.preferences.sunlight.mode !== 'automatic' ||
        this.snapshot.sunlightLocation.error ||
        this.now().getTime() - this.locationAttempt < 30 * 60_000)
    )
      return;
    if (this.locationAbort) return;
    if (!automatic)
      void this.setPreferences({
        sunlight: { ...this.snapshot.preferences.sunlight, mode: 'automatic' },
      });
    const abort = new AbortController();
    this.locationAbort = abort;
    const startedAt = this.now().getTime();
    this.locationAttempt = startedAt;
    this.patch({
      sunlightLocation: {
        ...this.snapshot.sunlightLocation,
        pending: true,
        candidate: undefined,
        error: null,
        issue: undefined,
      },
    });
    try {
      const point = await this.platform.locate(abort.signal, !automatic);
      if (
        abort.signal.aborted ||
        this.disposed ||
        this.snapshot.preferences.sunlight.mode !== 'automatic'
      )
        return;
      const now = this.now().getTime();
      const receivedAt = point.receivedAt ?? now;
      const lastKnown = validLastKnownPoint(point, now) && validLastKnownPoint(point, receivedAt);
      if (
        !Number.isFinite(receivedAt) ||
        receivedAt < startedAt ||
        receivedAt > now ||
        !(lastKnown || (!point.lastKnown && validLocatedPoint(point, receivedAt)))
      )
        throw new Error('定位结果无效或已过期，请重新定位或选择城市');
      const label =
        typeof point.label === 'string'
          ? Array.from(point.label.trim()).slice(0, 100).join('')
          : undefined;
      const located = { ...point, label: label || undefined };
      if (lastKnown) {
        this.patch({
          sunlightLocation: {
            ...this.snapshot.sunlightLocation,
            pending: false,
            candidate: located,
            error: '系统只返回了上次位置。若你仍在该地点，可以用它计算日照。',
          },
        });
        return;
      }
      this.patch({
        sunlightLocation: {
          pending: false,
          point: located,
          error: null,
        },
      });
    } catch (error) {
      if (!abort.signal.aborted && !this.disposed)
        this.patch({
          sunlightLocation: {
            ...this.snapshot.sunlightLocation,
            pending: false,
            error: error instanceof Error ? error.message : '定位失败，请重试或手动选择城市',
            issue: error instanceof LocationRequestError ? error.code : undefined,
          },
        });
    } finally {
      if (this.locationAbort === abort) this.locationAbort = undefined;
    }
  }
  dispose() {
    this.disposed = true;
    this.appUpdates.dispose();
    this.launchAtLogin.dispose();
    this.updateAbort?.abort();
    this.locationAbort?.abort();
    this.listeners.clear();
  }
}

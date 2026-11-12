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
} from '@shiri/calendar-core';
import { bundledHolidayDatasets } from '@shiri/calendar-core/data';

import type { CalendarPlatform, CalendarPreferences, SavedCalendarState } from './platform.js';

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
  panel: 'calendar' | 'settings';
  updating: boolean;
  error: string | null;
  notice: string | null;
  updatedAt?: string;
}

const defaults: CalendarPreferences = { weekStartsOn: 1, appearance: 'system' };
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
  if (
    (weekStartsOn !== 1 && weekStartsOn !== 7) ||
    !['system', 'light', 'dark'].includes(String(appearance))
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
    preferences: { weekStartsOn, appearance: appearance as CalendarPreferences['appearance'] },
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

  constructor(
    readonly platform: CalendarPlatform,
    private now: () => Date = () => new Date(),
  ) {
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
      preferences: { ...defaults },
      years: this.holidays.years,
      panel: 'calendar',
      updating: false,
      error: null,
      notice: null,
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

  showSettings(show = true) {
    this.patch({ panel: show ? 'settings' : 'calendar' });
  }
  dismissError() {
    this.patch({ error: null, notice: null });
  }

  setPreferences(preferences: Partial<CalendarPreferences>) {
    const next = { ...this.snapshot.preferences, ...preferences };
    if (
      (next.weekStartsOn !== 1 && next.weekStartsOn !== 7) ||
      !['system', 'light', 'dark'].includes(next.appearance)
    )
      throw new Error('显示设置无效');
    this.patch({ preferences: next });
    this.refresh();
    return this.persist();
  }

  private serialized(): SavedCalendarState {
    return {
      schemaVersion: 1,
      preferences: { ...this.snapshot.preferences },
      datasets: this.holidays.export(),
      updatedAt: this.snapshot.updatedAt,
    };
  }

  /** 串行保存，避免快速切换设置时旧写入覆盖新状态。 */
  private persist() {
    const state = this.serialized();
    this.saves = this.saves
      .then(() => this.platform.save(state))
      .catch(() => {
        this.patch({ error: '本地保存失败，本次操作仍在内存中。请检查存储空间或浏览器设置。' });
      });
    return this.saves;
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
  dispose() {
    this.disposed = true;
    this.updateAbort?.abort();
    this.listeners.clear();
  }
}

import { parseDate } from './date.js';
import type { DateKey, DaySchedule, HolidayDataset } from './types.js';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates untrusted JSON and returns an owned copy. Throws on malformed or conflicting data. */
export function parseHolidayDataset(input: unknown): HolidayDataset {
  if (
    !object(input) ||
    !Number.isInteger(input.year) ||
    typeof input.year !== 'number' ||
    input.year < 1901 ||
    input.year > 2100
  )
    throw new Error('调休数据年份无效');
  const { year, papers, days } = input;
  if (
    !Array.isArray(papers) ||
    papers.length === 0 ||
    papers.length > 30 ||
    !papers.every((paper: unknown) => {
      if (typeof paper !== 'string') return false;
      // URL is a Web API and is absent in JavaScriptCore. Validate HTTPS sources
      // without depending on a browser or accepting credentials/control characters.
      return /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s\\]*)?$/i.test(
        paper,
      );
    })
  )
    throw new Error('调休数据缺少 HTTPS 来源链接');
  if (!Array.isArray(days) || days.length === 0 || days.length > 400)
    throw new Error('调休日期列表无效');
  const seen = new Set<string>();
  const validated = days.map((entry: unknown) => {
    if (
      !object(entry) ||
      typeof entry.date !== 'string' ||
      typeof entry.name !== 'string' ||
      entry.name.trim().length === 0 ||
      entry.name.length > 40 ||
      typeof entry.isOffDay !== 'boolean'
    )
      throw new Error('调休日期条目格式无效');
    const parsed = parseDate(entry.date);
    // Annual notices may cover the previous December (e.g. New Year vacations).
    if (parsed.year !== year && !(parsed.year === year - 1 && parsed.month === 12))
      throw new Error('调休日期不属于对应年份或前一年十二月');
    if (seen.has(entry.date)) throw new Error(`调休日期重复：${entry.date}`);
    seen.add(entry.date);
    return { date: entry.date, name: entry.name, isOffDay: entry.isOffDay };
  });
  return {
    year,
    papers: [...papers],
    days: validated.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** In-memory schedule provider. Networking, file access and persistence belong to adapters. */
export class HolidayStore {
  private datasets = new Map<number, HolidayDataset>();
  private entries = new Map<DateKey, { name: string; isOffDay: boolean; sources: string[] }>();

  constructor(datasets: readonly HolidayDataset[] = []) {
    this.replace(datasets);
  }

  /** Atomically replaces all years; invalid input leaves the previous store intact. */
  replace(datasets: readonly unknown[]) {
    const validated = datasets.map(parseHolidayDataset);
    if (new Set(validated.map((item) => item.year)).size !== validated.length)
      throw new Error('调休数据包含重复年份');
    const next = new Map(validated.map((item) => [item.year, item]));
    const entries = new Map<DateKey, { name: string; isOffDay: boolean; sources: string[] }>();
    // Later notice years override earlier ones for shared December dates.
    for (const dataset of [...next.values()].sort((a, b) => a.year - b.year)) {
      for (const entry of dataset.days)
        entries.set(entry.date, { ...entry, sources: [...dataset.papers] });
    }
    this.datasets = next;
    this.entries = entries;
  }

  /** Imports one complete year; the adapter must establish its provenance before calling. */
  import(input: unknown) {
    const dataset = parseHolidayDataset(input);
    this.replace(
      [...this.datasets.values()].filter((item) => item.year !== dataset.year).concat(dataset),
    );
    return dataset.year;
  }

  /** Sorted years with a complete published schedule installed. */
  get years() {
    return [...this.datasets.keys()].sort((a, b) => a - b);
  }

  /** Exports copies for persistence without exposing mutable internal state. */
  export(): HolidayDataset[] {
    return [...this.datasets.values()].map(parseHolidayDataset);
  }

  /** Returns adjustment-aware rest/work status, explicitly distinguishing missing years. */
  get(date: DateKey): DaySchedule {
    const { year, value } = parseDate(date);
    const entry = this.entries.get(date);
    const coverage = this.datasets.has(year) || entry ? 'published' : 'unavailable';
    if (entry)
      return {
        kind: entry.isOffDay ? 'holiday' : 'makeup-workday',
        holidayName: entry.name,
        coverage,
        sources: [...entry.sources],
      };
    return {
      kind: value.getUTCDay() === 0 || value.getUTCDay() === 6 ? 'weekend' : 'weekday',
      coverage,
      sources: [...(this.datasets.get(year)?.papers ?? [])],
    };
  }
}

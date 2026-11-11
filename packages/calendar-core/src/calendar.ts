import { Solar } from 'lunar-typescript';
import { addDays, dateKey, daysBetween, MAX_YEAR, MIN_YEAR, parseDate } from './date.js';
import { HolidayStore } from './holidays.js';
import type { CalendarDay, CalendarEvent, DateKey, MonthCalendar, Vacation } from './types.js';

const FIXED_FESTIVALS: Record<string, string> = { '1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '3-12': '植树节', '5-1': '劳动节', '5-4': '青年节', '6-1': '儿童节', '7-1': '建党节', '8-1': '建军节', '9-10': '教师节', '10-1': '国庆节', '12-24': '平安夜', '12-25': '圣诞节' };
const LUNAR_FESTIVALS: Record<string, string> = { '1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头', '5-5': '端午节', '7-7': '七夕', '7-15': '中元节', '8-15': '中秋节', '9-9': '重阳节', '12-8': '腊八节' };
const UPPER_BOUND = `${MAX_YEAR}-12-31`;
const LOWER_BOUND = `${MIN_YEAR}-01-01`;

/** Date-only Chinese calendar engine, with an injectable holiday store and no platform APIs. */
export class CalendarEngine {
  private cache = new Map<DateKey, Omit<CalendarDay, 'schedule'>>();

  constructor(public readonly holidays = new HolidayStore()) {}

  /** Queries a civil date. Lunar dates/terms follow Chinese calendar conventions (UTC+8). */
  getDay(date: DateKey): CalendarDay {
    let base = this.cache.get(date);
    if (!base) {
      const { year, month, day, value } = parseDate(date);
      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      const lunarMonth = lunar.getMonth();
      const festivals: string[] = [];
      const fixed = FIXED_FESTIVALS[`${month}-${day}`];
      const traditional = lunarMonth > 0 ? LUNAR_FESTIVALS[`${lunarMonth}-${lunar.getDay()}`] : undefined;
      if (fixed) festivals.push(fixed);
      if (traditional) festivals.push(traditional);
      const term = lunar.getJieQi() || null;
      if (term === '清明') festivals.push('清明节');
      // The last lunar month may have 29 or 30 days. Never hard-code 腊月三十.
      if (lunarMonth === 12 && solar.next(1).getLunar().getMonth() === 1) festivals.push('除夕');
      const weekday = value.getUTCDay() || 7;
      if (month === 5 && weekday === 7 && day >= 8 && day <= 14) festivals.push('母亲节');
      if (month === 6 && weekday === 7 && day >= 15 && day <= 21) festivals.push('父亲节');
      base = {
        date, year, month, day, weekday,
        lunar: { year: lunar.getYear(), month: Math.abs(lunarMonth), day: lunar.getDay(), isLeapMonth: lunarMonth < 0, monthName: `${lunar.getMonthInChinese()}月`, dayName: lunar.getDayInChinese(), yearGanZhi: lunar.getYearInGanZhi(), zodiac: lunar.getYearShengXiao() },
        festivals, solarTerm: term,
      };
      if (this.cache.size >= 800) this.cache.clear();
      this.cache.set(date, base);
    }
    return { ...base, lunar: { ...base.lunar }, festivals: [...base.festivals], schedule: this.holidays.get(date) };
  }

  /** Returns a six-row month grid. Out-of-range boundary dates become blank cells. */
  getMonth(year: number, month: number, weekStartsOn: 1 | 7 = 1): MonthCalendar {
    const first = dateKey(year, month, 1);
    if (weekStartsOn !== 1 && weekStartsOn !== 7) throw new RangeError('每周起始日必须为周一或周日');
    const firstWeekday = parseDate(first).value.getUTCDay();
    const offset = (firstWeekday - (weekStartsOn === 1 ? 1 : 0) + 7) % 7;
    const startMs = parseDate(first).value.getTime() - offset * 86_400_000;
    const cells = Array.from({ length: 42 }, (_, index) => {
      const value = new Date(startMs + index * 86_400_000);
      if (value.getUTCFullYear() < MIN_YEAR || value.getUTCFullYear() > MAX_YEAR) return null;
      return this.getDay(dateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()));
    });
    return { year, month, weekStartsOn, cells, coverage: this.holidays.years.includes(year) ? 'published' : 'unavailable' };
  }

  /** Finds real festivals and/or solar terms from a date, including that date. */
  getUpcoming(from: DateKey, options: { days?: number; limit?: number; kind?: CalendarEvent['kind'] } = {}): CalendarEvent[] {
    parseDate(from);
    const { days = 100, limit = 8, kind } = options;
    if (!Number.isInteger(days) || days < 1 || days > 730 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('查询范围应为 1—730 天，数量应为 1—100');
    const result: CalendarEvent[] = [];
    let cursor = from;
    for (let offset = 0; offset < days; offset++) {
      const day = this.getDay(cursor);
      if (kind !== 'solar-term') for (const name of day.festivals) result.push({ date: cursor, name, kind: 'festival', daysUntil: offset });
      if (kind !== 'festival' && day.solarTerm) result.push({ date: cursor, name: day.solarTerm, kind: 'solar-term', daysUntil: offset });
      if (result.length >= limit || cursor === UPPER_BOUND) break;
      cursor = addDays(cursor, 1);
    }
    return result.slice(0, limit);
  }

  /** Finds scheduled vacations and extends them across adjoining ordinary weekends. */
  getVacations(from: DateKey, limit = 4): Vacation[] {
    parseDate(from);
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new RangeError('假期数量应为 1—30');
    const records = this.holidays.export().flatMap((item) => item.days).filter((item) => item.isOffDay).sort((a, b) => a.date.localeCompare(b.date));
    const vacations: Vacation[] = [];
    const rest = (date: DateKey) => { const schedule = this.holidays.get(date); return schedule.coverage === 'published' && (schedule.kind === 'holiday' || schedule.kind === 'weekend'); };
    for (const record of records) {
      if (vacations.some((vacation) => record.date >= vacation.start && record.date <= vacation.end)) continue;
      let start = record.date;
      let end = record.date;
      while (start > LOWER_BOUND && rest(addDays(start, -1))) start = addDays(start, -1);
      while (end < UPPER_BOUND && rest(addDays(end, 1))) end = addDays(end, 1);
      if (end < from) continue;
      vacations.push({ name: record.name, start, end, days: daysBetween(start, end) + 1, daysUntil: Math.max(0, daysBetween(from, start)) });
      if (vacations.length === limit) break;
    }
    return vacations;
  }
}

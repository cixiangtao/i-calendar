import type { DateKey } from './types.js';

export const MIN_YEAR = 1901;
export const MAX_YEAR = 2100;
const MS_PER_DAY = 86_400_000;

/** Validates civil dates strictly; rejects rollover such as February 30. */
export function parseDate(date: DateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('日期须使用 YYYY-MM-DD 格式');
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() + 1 !== month ||
    value.getUTCDate() !== day
  ) {
    throw new RangeError(`日期无效；支持 ${MIN_YEAR}—${MAX_YEAR} 年`);
  }
  return { year, month, day, value };
}

/** Builds a validated Gregorian date key. */
export function dateKey(year: number, month: number, day: number): DateKey {
  const date = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  parseDate(date);
  return date;
}

/** Adds civil days independently of the host timezone and daylight saving time. */
export function addDays(date: DateKey, amount: number): DateKey {
  if (!Number.isInteger(amount)) throw new RangeError('天数必须为整数');
  const { value } = parseDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return dateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

/** Difference in Gregorian calendar days: positive when to is after from. */
export function daysBetween(from: DateKey, to: DateKey) {
  return (parseDate(to).value.getTime() - parseDate(from).value.getTime()) / MS_PER_DAY;
}

/** Converts an instant to a civil date in an explicit IANA timezone. Defaults to mainland China. */
export function dateForInstant(instant: Date = new Date(), timeZone = 'Asia/Shanghai'): DateKey {
  if (!Number.isFinite(instant.getTime())) throw new RangeError('时间无效');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return dateKey(part('year'), part('month'), part('day'));
}

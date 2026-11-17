import { addDays, daysBetween, parseDate } from './date.js';
import type { HolidayStore } from './holidays.js';
import type { DateKey } from './types.js';

/** 缺少任一参与计算日期的调休安排时，不返回推测的工作日数量。 */
export type WorkdayCount =
  | { coverage: 'published'; days: number; missingYears: [] }
  | { coverage: 'unavailable'; days: null; missingYears: number[] };

/**
 * 按全国放假调休统计工作日，默认不计起始日、计入结束日。
 *
 * @param includeStart - 是否同时计入起始日；同日区间默认返回 0。
 * @throws 起止日期无效或结束日期早于起始日期时抛出 RangeError。
 */
export function countWorkdays(
  from: DateKey,
  to: DateKey,
  holidays: HolidayStore,
  includeStart = false,
): WorkdayCount {
  const distance = daysBetween(from, to);
  if (distance < 0) throw new RangeError('结束日期不能早于起始日期');
  const missingYears = new Set<number>();
  let days = 0;
  for (let offset = includeStart ? 0 : 1; offset <= distance; offset++) {
    const date = addDays(from, offset);
    const schedule = holidays.get(date);
    if (schedule.coverage === 'unavailable') missingYears.add(parseDate(date).year);
    else if (schedule.kind === 'weekday' || schedule.kind === 'makeup-workday') days++;
  }
  return missingYears.size
    ? { coverage: 'unavailable', days: null, missingYears: [...missingYears] }
    : { coverage: 'published', days, missingYears: [] };
}

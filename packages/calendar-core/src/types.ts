/** A Gregorian civil date, YYYY-MM-DD; never a timestamp. */
export type DateKey = string;

/** A versioned annual schedule. Only complete, officially published years belong here. */
export interface HolidayDataset {
  year: number;
  papers: string[];
  days: { date: DateKey; name: string; isOffDay: boolean }[];
}

/** Computed lunar information; leap months have a positive month plus isLeapMonth. */
export interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  monthName: string;
  dayName: string;
  yearGanZhi: string;
  zodiac: string;
}

/** Work/rest information is the national mainland schedule, not a person's shift pattern. */
export interface DaySchedule {
  kind: 'holiday' | 'makeup-workday' | 'weekend' | 'weekday';
  /** False means only the weekday/weekend pattern is known; adjustments are unknown. */
  coverage: 'published' | 'unavailable';
  holidayName?: string;
  sources: string[];
}

/** Serializable output. No dependency-specific Lunar or JavaScript Date objects escape. */
export interface CalendarDay {
  date: DateKey;
  year: number;
  month: number;
  day: number;
  /** ISO weekday: Monday = 1, Sunday = 7. */
  weekday: number;
  lunar: LunarDate;
  festivals: string[];
  solarTerm: string | null;
  schedule: DaySchedule;
}

/** A Monday-first or Sunday-first month grid. Boundaries may contain null cells. */
export interface MonthCalendar {
  year: number;
  month: number;
  weekStartsOn: 1 | 7;
  coverage: DaySchedule['coverage'];
  cells: (CalendarDay | null)[];
}

/** A civil-date event, with distance in calendar days from the query date. */
export interface CalendarEvent {
  date: DateKey;
  name: string;
  kind: 'festival' | 'solar-term';
  daysUntil: number;
}

/** A scheduled vacation, including adjacent ordinary weekends. */
export interface Vacation {
  name: string;
  start: DateKey;
  end: DateKey;
  days: number;
  daysUntil: number;
}

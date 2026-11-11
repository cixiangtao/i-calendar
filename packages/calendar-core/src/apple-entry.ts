import { CalendarEngine } from './calendar.js';
import { bundledHolidayDatasets } from './data.js';
import { HolidayStore } from './holidays.js';

/** JavaScriptCore adapter. Public outputs cross the bridge as JSON, not JS runtime objects. */
export function createBridge() {
  const holidays = new HolidayStore(bundledHolidayDatasets);
  const engine = new CalendarEngine(holidays);
  return {
    getDay: (date: string) => JSON.stringify(engine.getDay(date)),
    getMonth: (year: number, month: number, weekStartsOn: 1 | 7 = 1) => JSON.stringify(engine.getMonth(year, month, weekStartsOn)),
    getUpcoming: (date: string, days = 100, limit = 8) => JSON.stringify(engine.getUpcoming(date, { days, limit })),
    getVacations: (date: string, limit = 4) => JSON.stringify(engine.getVacations(date, limit)),
    getYears: () => JSON.stringify(holidays.years),
    importDataset: (json: string) => holidays.import(JSON.parse(json)),
    exportDatasets: () => JSON.stringify(holidays.export()),
  };
}

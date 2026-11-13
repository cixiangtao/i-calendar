import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bundledHolidayDatasets } from '../src/data.js';
import { addDays } from '../src/index.js';
import type { HolidayDataset } from '../src/types.js';

// 2026-11-13 按政府网站转载的国务院通知逐项核对，独立于 holiday-cn 快照。
const notices = [
  {
    year: 2025,
    source: 'https://www.forestry.gov.cn/c/www/szxx/594663.jhtml',
    vacations: [
      ['元旦', '01-01', '01-01'],
      ['春节', '01-28', '02-04'],
      ['清明节', '04-04', '04-06'],
      ['劳动节', '05-01', '05-05'],
      ['端午节', '05-31', '06-02'],
      ['国庆节、中秋节', '10-01', '10-08'],
    ],
    makeup: [
      ['春节', '01-26'],
      ['春节', '02-08'],
      ['劳动节', '04-27'],
      ['国庆节、中秋节', '09-28'],
      ['国庆节、中秋节', '10-11'],
    ],
  },
  {
    year: 2026,
    source: 'https://www.beijing.gov.cn/zhengce/zhengcefagui/202511/t20251104_4258873.html',
    vacations: [
      ['元旦', '01-01', '01-03'],
      ['春节', '02-15', '02-23'],
      ['清明节', '04-04', '04-06'],
      ['劳动节', '05-01', '05-05'],
      ['端午节', '06-19', '06-21'],
      ['中秋节', '09-25', '09-27'],
      ['国庆节', '10-01', '10-07'],
    ],
    makeup: [
      ['元旦', '01-04'],
      ['春节', '02-14'],
      ['春节', '02-28'],
      ['劳动节', '05-09'],
      ['国庆节', '09-20'],
      ['国庆节', '10-10'],
    ],
  },
  {
    year: 2027,
    source: 'https://www.dxh.gov.cn/ZWGK/zc_zwgk/ZFWJ/TZGG/202611/t20261106_2875104.shtml',
    vacations: [
      ['元旦', '01-01', '01-03'],
      ['春节', '02-05', '02-13'],
      ['清明节', '04-03', '04-05'],
      ['劳动节', '05-01', '05-05'],
      ['端午节', '06-09', '06-09'],
      ['中秋节', '09-15', '09-15'],
      ['国庆节', '10-01', '10-07'],
    ],
    makeup: [
      ['春节', '01-31'],
      ['春节', '02-14'],
      ['劳动节', '05-08'],
      ['国庆节', '09-26'],
      ['国庆节', '10-09'],
    ],
  },
] as const;

for (const notice of notices)
  test(`${notice.year} 年内置休班快照与国务院通知的完整日期、名称和性质一致`, () => {
    const expected: HolidayDataset['days'] = [];
    for (const [name, start, end] of notice.vacations) {
      const last = `${notice.year}-${end}`;
      for (let date = `${notice.year}-${start}`; date <= last; date = addDays(date, 1))
        expected.push({ date, name, isOffDay: true });
    }
    for (const [name, day] of notice.makeup)
      expected.push({ date: `${notice.year}-${day}`, name, isOffDay: false });
    expected.sort((a, b) => a.date.localeCompare(b.date));
    const dataset = bundledHolidayDatasets.find((item) => item.year === notice.year);
    assert.deepEqual(dataset?.days, expected, notice.source);
  });

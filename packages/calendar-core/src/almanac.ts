import { Solar } from 'lunar-typescript';

import { parseDate } from './date.js';
import type { AlmanacRules, DateKey, DayAlmanac } from './types.js';

/** 固定每日黄历口径；变更规则含义时升级 id，而非静默改变历史结果。 */
export const ALMANAC_RULES = Object.freeze({
  id: 'i-calendar-almanac-v1',
  timeZone: 'Asia/Shanghai',
  yearBoundary: 'lunar-new-year',
  monthBoundary: 'jie-day-start',
  dayBoundary: '00:00',
  yiJiSect: 1,
  fuSect: 1,
} as const satisfies AlmanacRules);

/** 记录实际锁定的上游版本；宜忌采用上游内置对照表，不作为官方放假安排。 */
export const ALMANAC_SOURCE = Object.freeze({
  library: 'lunar-typescript',
  version: '1.8.7',
  repository: 'https://github.com/6tail/lunar-typescript',
  ganZhiDocumentation: 'https://6tail.cn/calendar/lunar.ganzhi.html',
  yiJiDocumentation: 'https://6tail.cn/calendar/lunar.yiji.html',
  positionsDocumentation: 'https://6tail.cn/calendar/lunar.jishen.html',
} as const satisfies DayAlmanac['source']);

/**
 * 查询北京时间民用日期的传统黄历。无网络、文件系统或宿主时区依赖。
 *
 * 年以正月初一换年，月以节交接日零点换月，日以零点换日；宜忌与福神显式采用流派 1。 返回全新的普通对象与数组，不向调用方暴露上游实例。时辰数据不在此接口中推断。
 */
export function getAlmanac(date: DateKey): DayAlmanac {
  const { year, month, day } = parseDate(date);
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  return {
    date,
    ganZhi: {
      year: lunar.getYearInGanZhi(),
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
    },
    yi: [...lunar.getDayYi(ALMANAC_RULES.yiJiSect)],
    ji: [...lunar.getDayJi(ALMANAC_RULES.yiJiSect)],
    chong: lunar.getDayChongDesc(),
    sha: lunar.getDaySha(),
    positions: {
      xi: lunar.getDayPositionXiDesc(),
      fu: lunar.getDayPositionFuDesc(ALMANAC_RULES.fuSect),
      cai: lunar.getDayPositionCaiDesc(),
      yangGui: lunar.getDayPositionYangGuiDesc(),
      yinGui: lunar.getDayPositionYinGuiDesc(),
    },
    rules: { ...ALMANAC_RULES },
    source: { ...ALMANAC_SOURCE },
  };
}

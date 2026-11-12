import type { DayAlmanac } from '@shiri/calendar-core';
import Button from 'antd/es/button';
import { useEffect, useRef } from 'react';

import type { CalendarController, CalendarSnapshot } from './store.js';

/** 共享黄历内容；所展示的数值全部来自公共核心，不在界面里重算。 */
export function AlmanacContent({
  almanac,
  controller,
}: {
  almanac: DayAlmanac;
  controller: CalendarController;
}) {
  const directions = [
    ['喜神', almanac.positions.xi],
    ['福神', almanac.positions.fu],
    ['财神', almanac.positions.cai],
    ['阳贵神', almanac.positions.yangGui],
    ['阴贵神', almanac.positions.yinGui],
  ];
  return (
    <section
      className="almanac-content"
      aria-label="每日黄历"
    >
      <h2>传统黄历</h2>
      <dl className="almanac-pillars">
        {(
          [
            ['年干支', almanac.ganZhi.year],
            ['月干支', almanac.ganZhi.month],
            ['日干支', almanac.ganZhi.day],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="almanac-activities">
        <div className="almanac-activity almanac-yi">
          <h3>宜</h3>
          <p>{almanac.yi.join('、') || '资料未提供'}</p>
        </div>
        <div className="almanac-activity almanac-ji">
          <h3>忌</h3>
          <p>{almanac.ji.join('、') || '资料未提供'}</p>
        </div>
      </div>
      <dl className="almanac-directions">
        <div className="almanac-chong">
          <dt>冲煞</dt>
          <dd>
            冲{almanac.chong} · 煞{almanac.sha}
          </dd>
        </div>
        {directions.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="almanac-provenance">
        <summary>数据来源与口径</summary>
        <p>
          {almanac.source.library} {almanac.source.version} · 传统黄历资料
        </p>
        <ul>
          <li>干支年以正月初一换年。</li>
          <li>干支月以节交接日零点换月。</li>
          <li>日期按北京时间零点换日，未包含时辰。</li>
          <li>宜忌和福神固定使用上游流派一。</li>
        </ul>
        <p>宜忌采用上游整理的对照表，可能与其他黄历存在差异；原文“无”不表示“诸事皆宜”。</p>
        <div className="almanac-source-links">
          <button
            type="button"
            onClick={() => {
              void controller.openSource(almanac.source.yiJiDocumentation);
            }}
          >
            宜忌资料说明
          </button>
          <button
            type="button"
            onClick={() => {
              void controller.openSource(almanac.source.ganZhiDocumentation);
            }}
          >
            干支口径说明
          </button>
          <button
            type="button"
            onClick={() => {
              void controller.openSource(almanac.source.positionsDocumentation);
            }}
          >
            方位口径说明
          </button>
          <button
            type="button"
            onClick={() => {
              void controller.openSource(almanac.source.repository);
            }}
          >
            查看计算库
          </button>
        </div>
      </details>
    </section>
  );
}

/** 紧凑菜单栏与手机中的独立详情，内容可滚动，返回入口始终可见。 */
export function AlmanacPanel({
  state,
  controller,
  onBack,
}: {
  state: CalendarSnapshot;
  controller: CalendarController;
  onBack: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus();
  }, []);
  return (
    <section
      className="settings-panel almanac-panel"
      aria-labelledby="almanac-title"
    >
      <header className="settings-header">
        <Button
          ref={back}
          type="text"
          onClick={onBack}
        >
          返回日历
        </Button>
        <h1 id="almanac-title">黄历详情</h1>
      </header>
      <div className="almanac-date">
        <h2>
          {state.selected.year}年{state.selected.month}月{state.selected.day}日
        </h2>
        <p>
          农历{state.selected.lunar.monthName}
          {state.selected.lunar.dayName} · {state.selected.lunar.zodiac}年
        </p>
      </div>
      <AlmanacContent
        almanac={state.almanac}
        controller={controller}
      />
    </section>
  );
}

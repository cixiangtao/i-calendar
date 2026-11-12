import type { DayAlmanac } from '@shiri/calendar-core';

/** 共享黄历内容；所展示的数值全部来自公共核心，不在界面里重算。 */
export function AlmanacContent({ almanac }: { almanac: DayAlmanac }) {
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
      <dl
        className="almanac-pillars"
        aria-label="年月日干支"
      >
        {(
          [
            ['年干支', almanac.ganZhi.year, '年'],
            ['月干支', almanac.ganZhi.month, '月'],
            ['日干支', almanac.ganZhi.day, '日'],
          ] as const
        ).map(([label, value, suffix]) => (
          <div key={label}>
            <dt className="sr-only">{label}</dt>
            <dd>
              {value}
              <span>{suffix}</span>
            </dd>
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
    </section>
  );
}

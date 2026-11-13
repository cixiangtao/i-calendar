import type { DayAlmanac } from '@i-calendar/core';

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
      className="almanac-content tw-min-w-0 tw-pt-3"
      aria-label="每日黄历"
    >
      <div className="almanac-activities tw-grid tw-gap-2.5">
        <div className="almanac-activity almanac-yi tw-grid tw-grid-cols-[23px_minmax(0,_1fr)] tw-items-start tw-gap-[9px] [&_h3]:tw-m-0 [&_h3]:tw-grid [&_h3]:tw-min-h-[22px] [&_h3]:tw-place-items-center [&_h3]:tw-rounded-[6px] [&_h3]:tw-bg-green-soft [&_h3]:tw-text-[length:12px] [&_h3]:tw-font-medium [&_h3]:tw-text-green [&_p]:tw-m-0 [&_p]:tw-pt-px [&_p]:tw-text-[length:12px] [&_p]:tw-leading-[22px] [&_p]:tw-overflow-anywhere">
          <h3>宜</h3>
          <p>{almanac.yi.join('、') || '资料未提供'}</p>
        </div>
        <div className="almanac-activity almanac-ji tw-grid tw-grid-cols-[23px_minmax(0,_1fr)] tw-items-start tw-gap-[9px] [&_h3]:tw-m-0 [&_h3]:tw-grid [&_h3]:tw-min-h-[22px] [&_h3]:tw-place-items-center [&_h3]:tw-rounded-[6px] [&_h3]:tw-bg-green-soft [&_h3]:tw-bg-red-soft [&_h3]:tw-text-[length:12px] [&_h3]:tw-font-medium [&_h3]:tw-text-green [&_h3]:tw-text-red [&_p]:tw-m-0 [&_p]:tw-pt-px [&_p]:tw-text-[length:12px] [&_p]:tw-leading-[22px] [&_p]:tw-overflow-anywhere">
          <h3>忌</h3>
          <p>{almanac.ji.join('、') || '资料未提供'}</p>
        </div>
      </div>
      <dl className="almanac-directions tw-mx-0 tw-mb-0 tw-mt-3 tw-grid tw-grid-cols-[repeat(3,_minmax(0,_1fr))] tw-gap-[6px_12px] tw-border-0 tw-border-t tw-border-solid tw-border-line tw-px-0 tw-pb-0 tw-pt-3 tw-text-[length:12px] tw-leading-[20px] [&>div]:tw-flex [&>div]:tw-min-w-0 [&>div]:tw-items-baseline [&>div]:tw-gap-2 [&_.almanac-chong]:tw-col-[1_/_-1] [&_dd]:tw-m-0 [&_dd]:tw-overflow-anywhere [&_dt]:tw-shrink-0 [&_dt]:tw-text-secondary">
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

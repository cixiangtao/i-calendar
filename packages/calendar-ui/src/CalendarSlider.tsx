import type { CSSProperties } from 'react';

/** 百分比滑动条使用原生范围输入，支持指针、触控与键盘操作。 */
export function CalendarSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const percent = String(value) + '%';
  return (
    <label className="tw-grid tw-min-w-0 tw-gap-0.5 tw-text-xs tw-text-secondary">
      <span className="tw-flex tw-justify-between tw-gap-1.5">
        <span>{label}</span>
        <span
          aria-hidden="true"
          className="tw-min-w-[4ch] tw-text-right tw-tabular-nums tw-text-ink"
        >
          {percent}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={percent}
        className="calendar-slider tw-m-0 tw-h-6 tw-w-full tw-min-w-0 tw-cursor-pointer coarse:tw-h-11"
        min={0}
        max={100}
        value={value}
        style={{ '--slider-progress': percent } as CSSProperties}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

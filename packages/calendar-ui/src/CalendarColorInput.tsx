import type { ComponentPropsWithoutRef } from 'react';

/** 保留系统颜色面板，统一色块尺寸；焦点事件仍由宿主协调原生悬浮窗。 */
export function CalendarColorInput(
  props: Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'>,
) {
  return (
    <span className="calendar-color tw-relative tw-inline-flex tw-h-[var(--form-height)] tw-w-11 tw-shrink-0 tw-items-center before:tw-pointer-events-none before:tw-absolute before:tw-inset-x-0 before:tw-top-1/2 before:tw-h-[var(--form-height)] before:-tw-translate-y-1/2 before:tw-rounded-[var(--form-radius)] before:tw-bg-control before:tw-content-[''] focus-within:before:tw-outline focus-within:before:tw-outline-1 focus-within:before:tw-outline-offset-1 focus-within:before:tw-outline-secondary active:before:tw-bg-control-active coarse:tw-h-11 fine:hover:before:tw-bg-control-hover">
      <input
        {...props}
        type="color"
        className="tw-relative tw-m-0 tw-h-full tw-w-full tw-cursor-pointer tw-rounded-[var(--form-radius)] tw-border-0 tw-bg-transparent tw-p-[3px] tw-outline-none coarse:tw-py-[11px] [&::-moz-color-swatch]:tw-rounded-[5px] [&::-moz-color-swatch]:tw-border-0 [&::-webkit-color-swatch-wrapper]:tw-p-0 [&::-webkit-color-swatch]:tw-rounded-[5px] [&::-webkit-color-swatch]:tw-border-0"
      />
    </span>
  );
}

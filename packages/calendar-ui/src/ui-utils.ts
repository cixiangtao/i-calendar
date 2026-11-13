/** 只拼接完整静态类名，确保 Tailwind 构建扫描可发现。 */
export function cn(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ');
}

/** 保留值类型，避免选择器把数字 1 与字符串 "1" 混淆。 */
export function optionKey(value: string | number) {
  return `${typeof value}:${value}`;
}

export const controlFocus =
  'focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-secondary focus-visible:tw-outline-offset-2';

/** 弹层从根主题变量继承配色，并显式继承产品字体。 */
export const popupClasses =
  'tw-z-50 tw-box-border tw-rounded-xl tw-border tw-border-solid tw-border-line tw-bg-surface tw-p-1 tw-font-sans tw-text-[13px] tw-leading-5 tw-text-ink tw-outline-none';

export const popupItemClasses =
  'tw-relative tw-flex tw-min-h-8 tw-cursor-default tw-select-none tw-items-center tw-justify-between tw-gap-3 tw-rounded-lg tw-px-2 tw-py-1.5 tw-font-normal tw-tabular-nums tw-outline-none tw-transition-colors tw-duration-[var(--motion-feedback)] tw-ease-[var(--motion-ease)] data-[highlighted]:tw-bg-control-hover data-[disabled]:tw-pointer-events-none data-[disabled]:tw-text-muted coarse:tw-min-h-11';

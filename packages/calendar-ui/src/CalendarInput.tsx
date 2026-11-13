import type { ComponentPropsWithRef } from 'react';

import { cn } from './ui-utils.js';

export interface CalendarInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  status?: 'error' | 'warning';
}
/** 原生文本输入保留输入法、表单及无障碍语义，触屏只扩展透明区域。 */
export function CalendarInput({ disabled, status, className, ...props }: CalendarInputProps) {
  return (
    <span
      className={cn(
        'calendar-input tw-relative tw-inline-flex tw-h-[var(--form-height)] tw-min-w-0 tw-flex-1 tw-items-center coarse:tw-h-11',
        "before:tw-pointer-events-none before:tw-absolute before:tw-inset-x-0 before:tw-top-1/2 before:tw-h-[var(--form-height)] before:-tw-translate-y-1/2 before:tw-rounded-[var(--form-radius)] before:tw-bg-control before:tw-transition-colors before:tw-duration-[130ms] before:tw-content-['']",
        'focus-within:before:tw-outline focus-within:before:tw-outline-1 focus-within:before:tw-outline-offset-1 focus-within:before:tw-outline-secondary data-[disabled=true]:tw-opacity-50 data-[status=error]:before:tw-outline data-[status=warning]:before:tw-outline data-[status=error]:before:tw-outline-1 data-[status=warning]:before:tw-outline-1 data-[status=error]:before:tw-outline-red data-[status=warning]:before:tw-outline-yellow data-[disabled=false]:active:before:tw-bg-control-active data-[disabled=false]:fine:hover:before:tw-bg-control-hover',
      )}
      data-disabled={!!disabled}
      data-status={status}
    >
      <input
        {...props}
        type="text"
        disabled={disabled}
        className={cn(
          'calendar-input-field tw-relative tw-h-full tw-w-full tw-min-w-0 tw-rounded-[var(--form-radius)] tw-border-0 tw-bg-transparent tw-px-[var(--form-inset)] tw-py-0 tw-font-sans tw-text-[length:var(--form-font-size)] tw-leading-[var(--form-line-height)] tw-text-ink tw-caret-action tw-outline-none placeholder:tw-text-secondary disabled:tw-text-muted',
          className,
        )}
      />
    </span>
  );
}

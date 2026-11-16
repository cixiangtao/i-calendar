import * as Switch from '@radix-ui/react-switch';
import type { ComponentPropsWithoutRef } from 'react';

import { Spinner } from './CalendarButton.js';
import { cn, controlFocus } from './ui-utils.js';

export interface CalendarSwitchProps extends Omit<
  ComponentPropsWithoutRef<typeof Switch.Root>,
  'onChange' | 'onCheckedChange' | 'defaultChecked'
> {
  onChange: (checked: boolean) => void;
  loading?: boolean;
}
/** 20px 轨道、16px 滑块，使用现有语义色和独立的触控命中区域。 */
export function CalendarSwitch({
  checked,
  onChange,
  disabled,
  loading = false,
  className,
  ...props
}: CalendarSwitchProps) {
  return (
    <Switch.Root
      {...props}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'calendar-switch tw-relative tw-inline-flex tw-h-5 tw-w-9 tw-shrink-0 tw-items-center tw-rounded-full tw-border-0 tw-p-0 tw-outline-none tw-transition-colors tw-duration-[var(--motion-state)] tw-ease-[var(--motion-ease)] disabled:tw-cursor-default disabled:tw-opacity-50',
        "coarse:before:tw-absolute coarse:before:tw-left-1/2 coarse:before:tw-top-1/2 coarse:before:tw-h-11 coarse:before:tw-w-11 coarse:before:-tw-translate-x-1/2 coarse:before:-tw-translate-y-1/2 coarse:before:tw-content-['']",
        checked
          ? 'tw-bg-leaf enabled:active:tw-bg-leaf-active enabled:fine:hover:tw-bg-leaf-hover'
          : 'tw-bg-switch-off enabled:active:tw-bg-switch-off-active enabled:fine:hover:tw-bg-switch-off-hover',
        controlFocus,
        className,
      )}
    >
      <Switch.Thumb className="tw-pointer-events-none tw-relative tw-ml-0.5 tw-flex tw-h-4 tw-w-4 tw-items-center tw-justify-center tw-rounded-full tw-bg-[var(--switch-thumb)] tw-text-action tw-transition-transform tw-duration-[var(--motion-state)] tw-ease-[var(--motion-ease)] data-[state=checked]:tw-translate-x-4">
        {loading ? <Spinner /> : null}
      </Switch.Thumb>
    </Switch.Root>
  );
}

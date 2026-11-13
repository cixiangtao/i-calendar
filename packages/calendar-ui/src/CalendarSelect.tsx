import * as Select from '@radix-ui/react-select';
import { useEffect, useRef, useState } from 'react';

import { cn, optionKey, popupClasses, popupItemClasses } from './ui-utils.js';

export interface CalendarSelectOption<Value extends string | number> {
  value: Value;
  label: string;
  disabled?: boolean;
}
export interface CalendarSelectProps<Value extends string | number> {
  id?: string;
  label: string;
  value: Value;
  options: readonly CalendarSelectOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
  popupWidth?: number;
  disabled?: boolean;
}

/** Radix 管理选择、焦点与键盘；项目统一外观，保留值类型和 Esc 的层级。 */
export function CalendarSelect<Value extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  className,
  popupWidth = 128,
  disabled = false,
}: CalendarSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const pointer = useRef(false);
  useEffect(() => {
    const close = () => {
      setOpen(false);
      setKeyboardFocus(false);
      pointer.current = false;
    };
    window.addEventListener('blur', close);
    return () => window.removeEventListener('blur', close);
  }, []);
  return (
    <Select.Root
      value={optionKey(value)}
      onValueChange={(key) => {
        const option = options.find((item) => optionKey(item.value) === key);
        if (option && !option.disabled) onChange(option.value);
      }}
      open={open && !disabled}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <span
        className={cn(
          'calendar-select tw-relative tw-inline-flex tw-h-[var(--form-height)] tw-max-w-full tw-shrink-0 tw-items-center coarse:tw-h-11',
          "before:tw-pointer-events-none before:tw-absolute before:tw-inset-x-0 before:tw-top-1/2 before:tw-h-[var(--form-height)] before:-tw-translate-y-1/2 before:tw-rounded-[var(--form-radius)] before:tw-bg-control before:tw-transition-colors before:tw-duration-[130ms] before:tw-content-['']",
          'data-[disabled=true]:tw-opacity-50 data-[keyboard-focus=true]:before:tw-outline data-[keyboard-focus=true]:before:tw-outline-1 data-[keyboard-focus=true]:before:tw-outline-offset-1 data-[keyboard-focus=true]:before:tw-outline-secondary data-[disabled=false]:active:before:tw-bg-control-active data-[disabled=false]:fine:hover:before:tw-bg-control-hover',
          className,
        )}
        data-disabled={disabled}
        data-keyboard-focus={keyboardFocus || undefined}
        onPointerDownCapture={() => {
          pointer.current = true;
          setKeyboardFocus(false);
        }}
      >
        <Select.Trigger
          id={id}
          aria-label={label}
          className="calendar-select-field tw-relative tw-inline-flex tw-h-full tw-w-full tw-min-w-0 tw-items-center tw-justify-between tw-gap-0.5 tw-rounded-[var(--form-radius)] tw-border-0 tw-bg-transparent tw-px-[var(--form-inset)] tw-py-0 tw-font-sans tw-text-[length:var(--form-font-size)] tw-font-medium tw-tabular-nums tw-leading-[var(--form-line-height)] tw-text-ink tw-outline-none disabled:tw-text-muted"
          onFocus={() => {
            if (!pointer.current) setKeyboardFocus(true);
          }}
          onBlur={() => {
            if (!open) {
              pointer.current = false;
              setKeyboardFocus(false);
            }
          }}
          onKeyDown={() => {
            setKeyboardFocus(true);
          }}
        >
          <Select.Value>{options.find((option) => option.value === value)?.label}</Select.Value>
          <Select.Icon className="tw-flex tw-h-[13px] tw-w-[13px] tw-shrink-0 tw-items-center tw-text-secondary">
            <svg
              viewBox="0 0 16 16"
              className="tw-h-full tw-w-full tw-fill-none tw-stroke-current tw-stroke-[1.7]"
              aria-hidden="true"
            >
              <path
                d="m4 6 4 4 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Select.Icon>
        </Select.Trigger>
      </span>
      <Select.Portal>
        <Select.Content
          data-calendar-popup="select"
          position="popper"
          sideOffset={4}
          collisionPadding={12}
          className={cn('calendar-select-popup tw-max-w-[calc(100vw-24px)]', popupClasses)}
          style={{
            minWidth: 'var(--radix-select-trigger-width)',
            width: popupWidth,
            maxHeight: 'var(--radix-select-content-available-height)',
          }}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Select.Viewport className="tw-max-h-60 tw-overflow-y-auto tw-overscroll-contain">
            {options.map((option) => (
              <Select.Item
                key={optionKey(option.value)}
                value={optionKey(option.value)}
                disabled={option.disabled}
                className={popupItemClasses}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="tw-flex tw-shrink-0 tw-text-secondary">
                  <svg
                    viewBox="0 0 16 16"
                    className="tw-h-[13px] tw-w-[13px] tw-fill-none tw-stroke-current tw-stroke-[1.7]"
                    aria-hidden="true"
                  >
                    <path
                      d="m3 8 3 3 7-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

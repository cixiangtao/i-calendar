import * as RadioGroup from '@radix-ui/react-radio-group';

import { controlFocus, optionKey } from './ui-utils.js';

export interface CalendarSegmentedProps<Value extends string | number> {
  'aria-label': string;
  value: Value;
  options: readonly { value: Value; label: string; disabled?: boolean }[];
  onChange: (value: Value) => void;
}
/** 单选分段组保留方向键、Tab 和读屏语义，不暴露底层库的样式 API。 */
export function CalendarSegmented<Value extends string | number>({
  value,
  options,
  onChange,
  'aria-label': label,
}: CalendarSegmentedProps<Value>) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  return (
    <RadioGroup.Root
      aria-label={label}
      value={optionKey(value)}
      onValueChange={(key) => {
        const option = options.find((item) => optionKey(item.value) === key);
        if (option && !option.disabled) onChange(option.value);
      }}
      orientation="horizontal"
      className="calendar-segmented tw-relative tw-isolate tw-flex tw-max-w-[250px] tw-flex-1 tw-rounded-[var(--form-radius)] tw-bg-control tw-p-0.5"
    >
      {selectedIndex >= 0 ? (
        <span
          aria-hidden="true"
          className="tw-pointer-events-none tw-absolute tw-bottom-0.5 tw-left-0.5 tw-top-0.5 tw-rounded-md tw-bg-surface tw-transition-transform tw-duration-[var(--motion-state)] tw-ease-[var(--motion-ease)]"
          style={{
            width: `calc((100% - 4px) / ${options.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
      ) : null}
      {options.map((option) => (
        <RadioGroup.Item
          key={optionKey(option.value)}
          value={optionKey(option.value)}
          disabled={option.disabled}
          className={
            "tw-relative tw-min-h-6 tw-min-w-0 tw-flex-1 tw-select-none tw-whitespace-nowrap tw-rounded-md tw-border-0 tw-bg-transparent tw-px-2 tw-py-0 tw-font-sans tw-text-[13px] tw-font-normal tw-leading-6 tw-text-secondary tw-outline-none tw-transition-colors tw-duration-[var(--motion-feedback)] tw-ease-[var(--motion-ease)] disabled:tw-opacity-50 data-[state=checked]:tw-text-ink data-[state=checked]:tw-transition-[color] data-[state=unchecked]:enabled:active:tw-bg-control-active coarse:before:tw-absolute coarse:before:tw-inset-x-0 coarse:before:tw-top-1/2 coarse:before:tw-h-11 coarse:before:-tw-translate-y-1/2 coarse:before:tw-content-[''] data-[state=unchecked]:enabled:fine:hover:tw-bg-control-hover data-[state=unchecked]:enabled:fine:hover:tw-text-ink " +
            controlFocus
          }
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

import { dateKey, MAX_YEAR, MIN_YEAR, parseDate, type DateKey } from '@i-calendar/core';
import * as Popover from '@radix-ui/react-popover';
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarSelect } from './CalendarSelect.js';
import { cn, popupClasses } from './ui-utils.js';

/** 受控的公历日期选择器，日期使用核心支持的 YYYY-MM-DD。 */
export interface CalendarDatePickerProps {
  id: string;
  label: string;
  value: DateKey;
  /** 用于标记当天并提供「今天」快捷选项。 */
  today: DateKey;
  weekStartsOn?: 1 | 7;
  onChange: (value: DateKey) => void;
}

const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => {
  const value = MIN_YEAR + index;
  return { value, label: `${value}年` };
});
const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}月`,
}));
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const weekRow = 'tw-grid tw-grid-cols-7 tw-text-center';
const daySteps: Readonly<Partial<Record<string, number>>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 从当前日期打开选日面板，选定后关闭并恢复日期按钮焦点。 */
export function CalendarDatePicker({
  id,
  label,
  value,
  today,
  weekStartsOn = 1,
  onChange,
}: CalendarDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(value);
  const activeDay = useRef<HTMLButtonElement>(null);
  const focusDayAfterMove = useRef(false);
  const { year, month, day } = parseDate(cursor);
  const weekdayStart = weekStartsOn % 7;
  const firstColumn = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() - weekdayStart + 7) % 7;
  const monthLength = daysInMonth(year, month);
  const weekCount = Math.ceil((firstColumn + monthLength) / 7);
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const popupLabel = `选择${label}`;

  useLayoutEffect(() => {
    if (focusDayAfterMove.current) {
      focusDayAfterMove.current = false;
      activeDay.current?.focus();
    }
  });

  function move(next: Date, focusDay = false) {
    const nextYear = next.getUTCFullYear();
    if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) return;
    const nextDate = dateKey(nextYear, next.getUTCMonth() + 1, next.getUTCDate());
    if (nextDate === cursor) return;
    focusDayAfterMove.current = focusDay;
    setCursor(nextDate);
  }

  function changeMonth(nextYear: number, nextMonth: number, focusDay = false) {
    move(
      new Date(Date.UTC(nextYear, nextMonth - 1, Math.min(day, daysInMonth(nextYear, nextMonth)))),
      focusDay,
    );
  }

  function navigateDays(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const step = daySteps[event.key];
    if (typeof step === 'number') {
      event.preventDefault();
      move(new Date(Date.UTC(year, month - 1, day + step)), true);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      changeMonth(year, month + (event.key === 'PageUp' ? -1 : 1), true);
    }
  }

  function pick(date: DateKey) {
    onChange(date);
    setOpen(false);
  }

  return (
    <div className="tw-flex tw-min-w-0 tw-flex-col tw-gap-2">
      <label
        id={labelId}
        htmlFor={id}
      >
        {label}
      </label>
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setCursor(value);
          setOpen(nextOpen);
        }}
      >
        <div className="tw-flex tw-min-w-0 tw-items-center coarse:tw-h-11">
          <Popover.Trigger asChild>
            <CalendarButton
              id={id}
              aria-labelledby={`${labelId} ${valueId}`}
              className="tw-w-full tw-min-w-0 tw-justify-between tw-tabular-nums"
            >
              <time
                id={valueId}
                dateTime={value}
              >
                {value}
              </time>
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="tw-shrink-0 tw-text-secondary"
              >
                <rect
                  x="2.25"
                  y="3.5"
                  width="11.5"
                  height="10.25"
                  rx="2"
                />
                <path d="M5.25 2.25v2.5m5.5-2.5v2.5M2.5 6.75h11m-8 3.2h1m2 0h1" />
              </svg>
            </CalendarButton>
          </Popover.Trigger>
        </div>
        <Popover.Portal>
          <Popover.Content
            aria-label={popupLabel}
            data-calendar-popup="date-picker"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              popupClasses,
              'tw-w-64 tw-max-w-[calc(100vw-16px)] tw-overflow-y-auto tw-overscroll-contain tw-p-2 coarse:tw-w-[21rem]',
            )}
            style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}
            onOpenAutoFocus={(event) => {
              if (!activeDay.current) return;
              event.preventDefault();
              activeDay.current.focus({ preventScroll: true });
            }}
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
              <CalendarSelect
                label="年份"
                value={year}
                options={years}
                className="tw-w-[78px]"
                onChange={(nextYear) => changeMonth(nextYear, month)}
              />
              <div
                role="group"
                aria-label="切换月份"
                className="tw-flex tw-items-center tw-gap-1"
              >
                <CalendarButton
                  appearance="toolbar"
                  className="before:tw-box-border coarse:tw-mx-2"
                  aria-label="上个月"
                  disabled={year === MIN_YEAR && month === 1}
                  onClick={() => changeMonth(year, month - 1)}
                  icon={<MonthChevron />}
                />
                <CalendarSelect
                  label="月份"
                  value={month}
                  options={months}
                  className="tw-w-[62px]"
                  onChange={(nextMonth) => changeMonth(year, nextMonth)}
                />
                <CalendarButton
                  appearance="toolbar"
                  className="before:tw-box-border coarse:tw-mx-2"
                  aria-label="下个月"
                  disabled={year === MAX_YEAR && month === 12}
                  onClick={() => changeMonth(year, month + 1)}
                  icon={<MonthChevron next />}
                />
              </div>
            </div>
            <div
              role="grid"
              aria-label={`${year}年${month}月`}
              aria-colcount={7}
              className="tw-mt-2"
            >
              <div
                role="row"
                className={cn(weekRow, 'tw-pb-1 tw-text-xs tw-font-medium tw-text-secondary')}
              >
                {weekdays.map((_, index) => {
                  const weekday = weekdays[(weekdayStart + index) % 7];
                  return (
                    <span
                      key={weekday}
                      role="columnheader"
                      aria-label={`星期${weekday}`}
                    >
                      {weekday}
                    </span>
                  );
                })}
              </div>
              {Array.from({ length: weekCount }, (_, week) => (
                <div
                  key={week}
                  role="row"
                  className={weekRow}
                >
                  {weekdays.map((weekday, column) => {
                    const number = week * 7 + column - firstColumn + 1;
                    if (number < 1 || number > monthLength)
                      return (
                        <div
                          key={weekday}
                          role="gridcell"
                          aria-hidden="true"
                        />
                      );
                    const date = dateKey(year, month, number);
                    return (
                      <div
                        key={weekday}
                        role="gridcell"
                        aria-colindex={column + 1}
                        aria-selected={date === value}
                      >
                        <button
                          ref={date === cursor ? activeDay : undefined}
                          type="button"
                          data-date={date}
                          aria-label={`${year}年${month}月${number}日`}
                          aria-current={date === today ? 'date' : undefined}
                          tabIndex={date === cursor ? 0 : -1}
                          className={cn(
                            'tw-h-8 tw-w-full tw-rounded-[var(--form-radius)] tw-border-0 tw-p-0 tw-font-sans tw-text-[13px] tw-tabular-nums tw-outline-none focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-offset-[-2px] focus-visible:tw-outline-secondary coarse:tw-h-11',
                            date === value
                              ? 'tw-bg-leaf tw-text-[var(--leaf-ink)] fine:hover:tw-bg-leaf-hover'
                              : 'tw-bg-transparent active:tw-bg-control-active fine:hover:tw-bg-control-hover',
                            date !== value &&
                              (date === today ? 'tw-font-semibold tw-text-action' : 'tw-text-ink'),
                          )}
                          onKeyDown={navigateDays}
                          onClick={() => pick(date)}
                        >
                          {number}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="tw-mt-1 tw-flex tw-justify-end coarse:tw-p-2">
              <CalendarButton
                appearance="text"
                onClick={() => pick(today)}
              >
                今天
              </CalendarButton>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function MonthChevron({ next = false }: { next?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('tw-shrink-0', next && 'tw-rotate-180')}
    >
      <path d="m9.5 4-4 4 4 4" />
    </svg>
  );
}

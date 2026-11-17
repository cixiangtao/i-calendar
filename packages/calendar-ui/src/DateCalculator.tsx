import {
  addDays,
  countWorkdays,
  daysBetween,
  parseDate,
  type DateKey,
  type HolidayStore,
} from '@i-calendar/core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarInput } from './CalendarInput.js';
import { CalendarSegmented } from './CalendarSegmented.js';
import { CalendarSwitch } from './CalendarSwitch.js';

type CalculatorMode = 'distance' | 'offset' | 'workdays';

interface DateCalculatorProps {
  holidays: HolidayStore;
  selectedDate: DateKey;
  today: DateKey;
  onBack: () => void;
  onViewDate: (date: DateKey) => void;
}

function dateError(value: string) {
  try {
    parseDate(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : '请输入有效日期';
  }
}

function DateField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tw-flex tw-min-w-0 tw-flex-col tw-gap-2">
      <label htmlFor={id}>{label}</label>
      <CalendarInput
        id={id}
        value={value}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        status={error ? 'error' : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : 'calculator-date-hint'}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p
          id={`${id}-error`}
          className="tw-m-0 tw-text-xs tw-leading-5 tw-text-red"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 本地日期工具复用共享核心；草稿只在本次工具页面内保留，不写入用户偏好。 */
export function DateCalculator({
  holidays,
  selectedDate,
  today,
  onBack,
  onViewDate,
}: DateCalculatorProps) {
  const [mode, setMode] = useState<CalculatorMode>('distance');
  const [start, setStart] = useState(selectedDate);
  const [end, setEnd] = useState(today);
  const [amount, setAmount] = useState('100');
  const [includeStart, setIncludeStart] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);

  const startError = dateError(start);
  const endError = mode === 'offset' ? null : dateError(end);
  const amountError =
    mode === 'offset' && (!/^[+-]?\d+$/.test(amount) || !Number.isSafeInteger(Number(amount)))
      ? '请输入整数天数，向前推算时使用负数。'
      : null;
  const result = useMemo(() => {
    if (startError || endError || amountError)
      return { text: '等待有效输入', detail: '请先检查上方日期与天数。' };
    if (mode === 'distance') {
      const distance = daysBetween(start, end);
      return {
        text: `相隔 ${Math.abs(distance)} 天`,
        detail:
          distance === 0
            ? '起始日期和结束日期是同一天。'
            : `结束日期在起始日期${distance > 0 ? '之后' : '之前'}；按公历自然日计算，不重复计入起始日。`,
        date: end,
      };
    }
    if (mode === 'offset') {
      try {
        const date = addDays(start, Number(amount));
        return {
          text: date,
          detail:
            Number(amount) === 0
              ? '推算 0 天，日期保持不变。'
              : `从 ${start} ${Number(amount) > 0 ? '往后' : '往前'}推算 ${Math.abs(Number(amount))} 个自然日。`,
          date,
        };
      } catch {
        return {
          text: '推算超出范围',
          detail: '请调整起始日期或天数，使结果在 1901—2100 年内。',
          warning: true,
        };
      }
    }
    if (daysBetween(start, end) < 0)
      return {
        text: '请调整日期顺序',
        detail: '工作日计算的结束日期不能早于起始日期。',
        warning: true,
      };
    const count = countWorkdays(start, end, holidays, includeStart);
    if (count.coverage === 'unavailable')
      return {
        text: '无法确定工作日',
        detail: `${count.missingYears.join('、')} 年调休未收录。可在设置的数据页检查更新或导入已核对的年度安排。`,
        warning: true,
      };
    return {
      text: `${count.days} 个工作日`,
      detail: `${includeStart ? '计入' : '不计'}起始日、计入结束日；按全国放假调休安排，扣除休假与普通周末，计入补班。`,
      date: end,
    };
  }, [mode, start, end, amount, includeStart, holidays, startError, endError, amountError]);

  return (
    <section
      className="tw-flex tw-h-[min(640px,_calc(100svh_-_64px))] tw-min-h-0 tw-min-w-0 tw-flex-col tw-overflow-hidden tw-rounded-[22px] tw-bg-surface tw-p-5 mac:tw-h-full mac:tw-rounded-[18px] mac:tw-p-3 compact:tw-h-[calc(100svh_-_24px)] mac:compact:tw-h-full"
      aria-labelledby="calculator-title"
    >
      <header className="tw-mb-5 tw-flex tw-min-h-[30px] tw-shrink-0 tw-items-center tw-justify-between tw-gap-3">
        <CalendarButton
          ref={back}
          appearance="text"
          className="app:tw-pl-0"
          onClick={onBack}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 5-7 7 7 7" />
          </svg>
          返回日历
        </CalendarButton>
        <h1
          id="calculator-title"
          className="tw-m-0 tw-text-[15px] tw-font-semibold"
        >
          日期计算
        </h1>
      </header>
      <div className="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-overscroll-contain tw-px-0.5 tw-pb-3">
        <CalendarSegmented<CalculatorMode>
          aria-label="计算方式"
          value={mode}
          options={[
            { value: 'distance', label: '日期间隔' },
            { value: 'offset', label: '前后推算' },
            { value: 'workdays', label: '工作日' },
          ]}
          onChange={setMode}
        />
        <p
          id="calculator-date-hint"
          className="tw-mb-5 tw-mt-4 tw-text-xs tw-leading-5 tw-text-secondary"
        >
          日期格式为 YYYY-MM-DD，支持 1901—2100 年。
        </p>
        <div className="tw-grid tw-grid-cols-2 tw-items-start tw-gap-4">
          <DateField
            id="calculator-start"
            label="起始日期"
            value={start}
            error={startError}
            onChange={setStart}
          />
          {mode === 'offset' ? (
            <div className="tw-flex tw-min-w-0 tw-flex-col tw-gap-2">
              <label htmlFor="calculator-amount">推算天数</label>
              <CalendarInput
                id="calculator-amount"
                value={amount}
                placeholder="例如 100 或 -7"
                maxLength={7}
                autoComplete="off"
                status={amountError ? 'error' : undefined}
                aria-invalid={!!amountError}
                aria-describedby={
                  amountError ? 'calculator-amount-error' : 'calculator-offset-hint'
                }
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountError ? (
                <p
                  id="calculator-amount-error"
                  className="tw-m-0 tw-text-xs tw-leading-5 tw-text-red"
                >
                  {amountError}
                </p>
              ) : null}
            </div>
          ) : (
            <DateField
              id="calculator-end"
              label="结束日期"
              value={end}
              error={endError}
              onChange={setEnd}
            />
          )}
        </div>
        <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-x-4 tw-gap-y-2 coarse:tw-gap-y-4">
          <CalendarButton
            appearance="text"
            className="app:tw-px-0"
            onClick={() => setStart(today)}
          >
            从今天开始
          </CalendarButton>
          <CalendarButton
            appearance="text"
            className="app:tw-px-0"
            onClick={() => setStart(selectedDate)}
          >
            使用所选日期
          </CalendarButton>
        </div>
        {mode === 'offset' ? (
          <p
            id="calculator-offset-hint"
            className="tw-mb-0 tw-mt-4 tw-text-xs tw-leading-5 tw-text-secondary"
          >
            正数往后推算，负数往前推算，0 为当天。
          </p>
        ) : null}
        {mode === 'workdays' ? (
          <div className="tw-mt-5 tw-flex tw-min-h-7 tw-items-center tw-justify-between tw-gap-3 coarse:tw-min-h-11">
            <label htmlFor="calculator-include-start">计入起始日</label>
            <CalendarSwitch
              id="calculator-include-start"
              checked={includeStart}
              onChange={setIncludeStart}
            />
          </div>
        ) : null}
        <section
          className="tw-mt-6 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-5"
          aria-labelledby="calculator-result-title"
        >
          <h2
            id="calculator-result-title"
            className="tw-m-0 tw-text-[13px] tw-font-medium tw-text-secondary"
          >
            计算结果
          </h2>
          <output
            className="tw-block"
            aria-labelledby="calculator-result-title"
            aria-live="polite"
            aria-atomic="true"
          >
            <span
              className={`tw-mb-2 tw-mt-3 tw-block tw-text-2xl tw-font-semibold tw-tabular-nums tw-leading-8 ${result.warning ? 'tw-text-yellow' : 'tw-text-ink'}`}
            >
              {result.text}
            </span>
            <span className="tw-block tw-text-xs tw-leading-6 tw-text-secondary">
              {result.detail}
            </span>
          </output>
          {result.date ? (
            <CalendarButton
              className="tw-mt-4"
              onClick={() => onViewDate(result.date)}
            >
              在月历中查看
            </CalendarButton>
          ) : null}
        </section>
        {mode === 'workdays' ? (
          <p className="tw-mb-0 tw-mt-6 tw-text-xs tw-leading-5 tw-text-secondary">
            适用于中国大陆全国统一安排，不含个人排班与地方假期。
          </p>
        ) : null}
      </div>
    </section>
  );
}

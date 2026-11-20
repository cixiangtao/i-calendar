import type { CalendarDay } from '@i-calendar/core';
import type { FortuneItem } from 'acer-almanac';
import { useEffect, useId, useRef, useState } from 'react';

import { CalendarButton } from './CalendarButton.js';

type DailySignResult = { status: 'loading' | 'error' } | { status: 'ready'; items: FortuneItem[] };

/** 为当前选中日按需展开生活灵感，选日时由调用方重置展开状态。 */
export function DailySign({ day }: { day: CalendarDay }) {
  const contentId = useId();
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DailySignResult>();

  async function loadSign() {
    setResult({ status: 'loading' });
    try {
      const { generateFortuneV2 } = await import('acer-almanac');
      const { good } = generateFortuneV2(day);
      setResult({ status: 'ready', items: good.slice(0, 3) });
    } catch {
      setResult({ status: 'error' });
    }
  }

  useEffect(() => {
    if (open && result && result.status !== 'loading') {
      content.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, result]);

  return (
    <div className="tw-mt-3 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-2">
      <CalendarButton
        appearance="text"
        className="tw-w-full tw-justify-between [--form-inset:6px]"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => {
          setOpen(!open);
          if (!open && (!result || result.status === 'error')) void loadSign();
        }}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span className="tw-inline-flex tw-items-center tw-gap-1.5">
          <svg
            viewBox="0 0 16 16"
            className="tw-size-3.5 tw-fill-none tw-stroke-current"
            strokeWidth="1.15"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 1.5 9.7 6.3 14.5 8 9.7 9.7 8 14.5 6.3 9.7 1.5 8 6.3 6.3Z" />
          </svg>
          每日签
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`tw-size-3.5 tw-fill-none tw-stroke-current ${open ? 'tw-rotate-180' : ''}`}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </CalendarButton>
      <div
        ref={content}
        id={contentId}
        hidden={!open}
        className="tw-px-1.5 tw-pb-2 tw-pt-3"
      >
        {result?.status === 'ready' ? (
          <>
            <time
              dateTime={day.date}
              className="tw-block tw-text-[11px] tw-tabular-nums tw-leading-[17px] tw-text-secondary"
            >
              {day.year}年{day.month}月{day.day}日
            </time>
            <ul className="tw-my-1.5 tw-list-none tw-p-0 tw-text-xs tw-leading-5">
              {result.items.map(({ activity, description }) => (
                <li
                  key={activity}
                  className="tw-border-0 tw-border-b tw-border-solid tw-border-line tw-py-2"
                >
                  <strong className="tw-font-semibold">{activity}</strong>
                  <p className="tw-m-0 tw-text-secondary">{description}</p>
                </li>
              ))}
            </ul>
            <p className="tw-m-0 tw-text-[11px] tw-leading-[17px] tw-text-secondary">
              按日期生成，仅供娱乐。
            </p>
          </>
        ) : (
          <output className="tw-block tw-text-xs tw-leading-5 tw-text-secondary">
            {result?.status === 'error' ? '每日签加载失败，可收起后重试。' : '正在加载每日签…'}
          </output>
        )}
      </div>
    </div>
  );
}

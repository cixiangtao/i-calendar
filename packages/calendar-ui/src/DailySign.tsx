import type { CalendarDay } from '@i-calendar/core';
import { Fragment, useId, useRef, useState, type KeyboardEvent } from 'react';

import { CalendarButton } from './CalendarButton.js';
import type { createDailySign } from './daily-sign-content.js';
import { DailySignCup } from './DailySignCup.js';

type DailySignResult =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; sign: ReturnType<typeof createDailySign> };

interface DailySignProps {
  day: CalendarDay;
  drawn: boolean;
  onDrawn: () => void;
  onReset?: () => void;
}

function SignActivities({ activities }: { activities: readonly string[] }) {
  return activities.map((activity, index) => {
    const hasSeparator = index + 1 < activities.length;
    return (
      <Fragment key={activity}>
        <span className="tw-inline-block tw-max-w-full tw-break-words">
          {activity}
          {hasSeparator ? <span className="tw-text-secondary">{' /'}</span> : null}
        </span>
        {hasSeparator ? ' ' : null}
      </Fragment>
    );
  });
}

/** 展开所选日期的签筒，摇签结束后揭晓同一天固定的签文。 */
export function DailySign({ day, drawn, onDrawn, onReset }: DailySignProps) {
  const contentId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const drawButton = useRef<HTMLButtonElement>(null);
  const [requestedOpen, setRequestedOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<DailySignResult>();
  // 筒与签面共同决定展开高度，加载完成后一次呈现。
  const open = requestedOpen && !!result && result.status !== 'loading';

  async function loadSign() {
    setResult({ status: 'loading' });
    try {
      const { createDailySign } = await import('./daily-sign-content.js');
      setResult({ status: 'ready', sign: createDailySign(day) });
    } catch {
      setResult({ status: 'error' });
    }
  }

  function handleEscape(event: KeyboardEvent<HTMLButtonElement>) {
    if (!requestedOpen || event.key !== 'Escape') return;
    event.preventDefault();
    setRequestedOpen(false);
    setDrawing(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function reveal() {
    if (document.activeElement === drawButton.current)
      trigger.current?.focus({ preventScroll: true });
    setDrawing(false);
    onDrawn();
  }

  function draw() {
    if (drawing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) reveal();
    else setDrawing(true);
  }

  return (
    <div className="tw-mt-3 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-2">
      <CalendarButton
        ref={trigger}
        appearance="text"
        className="tw-w-full tw-justify-between [--form-inset:6px]"
        aria-expanded={open}
        aria-controls={contentId}
        aria-busy={(requestedOpen && result?.status === 'loading') || undefined}
        onClick={() => {
          setRequestedOpen(!requestedOpen);
          if (requestedOpen) setDrawing(false);
          else if (!result || result.status === 'error') void loadSign();
        }}
        onKeyDown={handleEscape}
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
        id={contentId}
        hidden={!open}
        className="tw-pt-2"
      >
        {result?.status === 'ready' ? (
          <div className="tw-grid tw-min-h-[154px] tw-items-center tw-rounded-xl tw-bg-[var(--yellow-soft)] tw-p-2">
            <CalendarButton
              ref={drawButton}
              appearance="text"
              className={`tw-col-start-1 tw-row-start-1 tw-mx-auto tw-flex tw-w-16 tw-flex-col tw-gap-0 [--form-height:112px] [--form-inset:0px] enabled:active:before:!tw-bg-transparent data-[hovered=true]:before:!tw-bg-transparent ${drawn ? 'tw-invisible' : ''}`}
              aria-hidden={drawn || undefined}
              aria-label="摇一签"
              aria-disabled={drawing || undefined}
              aria-busy={drawing || undefined}
              onClick={draw}
              onKeyDown={handleEscape}
            >
              <span className="daily-sign-hover tw-pointer-events-none tw-shrink-0">
                <DailySignCup
                  drawing={drawing}
                  onDrawn={reveal}
                />
              </span>
              <span aria-hidden="true">{drawing ? '摇签中…' : '摇一签'}</span>
            </CalendarButton>
            {/* 两层重叠并同时参与定高，切到签面时日历不会再次撑高。 */}
            <div
              className={`tw-col-start-1 tw-row-start-1 tw-min-w-0 tw-px-2.5 tw-py-2 ${drawn ? '' : 'tw-invisible'}`}
              aria-hidden={!drawn || undefined}
            >
              <header className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <h3 className="tw-m-0 tw-min-w-0 tw-break-words tw-text-[18px] tw-font-semibold tw-leading-6">
                  {result.sign.title}
                </h3>
                <span className="tw-shrink-0 tw-rounded-[5px] tw-border tw-border-solid tw-border-line tw-bg-surface tw-px-1.5 tw-text-[11px] tw-font-medium tw-leading-[18px] tw-text-ink">
                  {result.sign.rank}
                </span>
              </header>
              <dl className="tw-mx-0 tw-mb-0 tw-mt-2.5 tw-grid tw-grid-cols-[22px_minmax(0,_1fr)] tw-items-start tw-gap-x-2.5 tw-gap-y-2 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-2.5 tw-text-[13px] tw-leading-[22px]">
                <dt className="tw-rounded-md tw-bg-green-soft tw-text-center tw-text-xs tw-font-semibold tw-text-green">
                  宜
                </dt>
                <dd className="tw-m-0">
                  <SignActivities activities={result.sign.good} />
                </dd>
                <dt className="tw-rounded-md tw-bg-red-soft tw-text-center tw-text-xs tw-font-semibold tw-text-red">
                  忌
                </dt>
                <dd className="tw-m-0">
                  <SignActivities activities={result.sign.bad} />
                </dd>
              </dl>
              <div className="tw-mt-2.5 tw-flex tw-items-center tw-gap-2">
                {onReset ? (
                  <CalendarButton
                    appearance="text"
                    className="[--form-font-size:11px] [--form-height:24px] [--form-inset:6px]"
                    onClick={() => {
                      trigger.current?.focus({ preventScroll: true });
                      onReset();
                    }}
                    onKeyDown={handleEscape}
                  >
                    重置抽签
                  </CalendarButton>
                ) : null}
                <p className="tw-m-0 tw-ml-auto tw-text-right tw-text-[11px] tw-leading-[17px] tw-text-secondary">
                  仅供娱乐
                </p>
              </div>
            </div>
            <output className="sr-only">
              {drawn ? `${result.sign.rank}，${result.sign.title}。` : ''}
            </output>
          </div>
        ) : result?.status === 'error' ? (
          <output className="tw-block tw-px-1.5 tw-text-xs tw-leading-5 tw-text-secondary">
            每日签加载失败，可收起后重试。
          </output>
        ) : null}
      </div>
    </div>
  );
}

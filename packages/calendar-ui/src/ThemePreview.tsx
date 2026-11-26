import type { CalendarDay } from '@i-calendar/core';
import { useMemo, useState } from 'react';

import { colorContrastIssues, resolveThemeTokens } from './color-theme.js';
import type { CalendarSnapshot } from './store.js';
import { themeBackground } from './theme-image.js';
import type { CalendarThemePackage } from './theme-package.js';
import { ThemeBackdrop } from './ThemeBackdrop.js';

function caption(day: CalendarDay) {
  return day.festivals[0] ?? day.solarTerm ?? day.lunar.dayName;
}

/** 用当前日历的一周即时预览配色和背景裁切。 */
export function ThemePreview({
  theme,
  mode,
  state,
  increasedContrast,
}: {
  theme: CalendarThemePackage;
  mode: 'light' | 'dark';
  state: CalendarSnapshot;
  increasedContrast: boolean;
}) {
  const tokens = useMemo(
    () => resolveThemeTokens(theme, mode === 'dark', increasedContrast),
    [theme, mode, increasedContrast],
  );
  const issues = useMemo(
    () => colorContrastIssues(tokens, increasedContrast),
    [tokens, increasedContrast],
  );
  const selectedIndex = state.month.cells.findIndex((day) => day?.date === state.selected.date);
  const weekStart = Math.max(0, Math.floor(selectedIndex / 7) * 7);
  const week = state.month.cells.slice(weekStart, weekStart + 7);
  const background = themeBackground(theme);
  const [failedImage, setFailedImage] = useState('');
  return (
    <div className="tw-grid tw-gap-1.5">
      <div
        className="theme-mini-calendar tw-relative tw-isolate tw-overflow-hidden tw-rounded-xl tw-bg-canvas tw-text-ink"
        data-theme-photo={background?.strength ? true : undefined}
        style={{ ...tokens, colorScheme: mode }}
        aria-label="月历配色预览"
      >
        <ThemeBackdrop
          background={background}
          dark={mode === 'dark'}
          onImageStatus={(source, loaded) => setFailedImage(loaded ? '' : source)}
        />
        <div className="tw-relative tw-overflow-hidden tw-rounded-lg tw-bg-panel">
          <div className="tw-flex tw-min-h-11 tw-items-center tw-justify-between tw-gap-2 tw-px-2.5">
            <strong className="tw-rounded-lg tw-bg-control tw-px-2 tw-py-1 tw-text-xs tw-font-semibold">
              {state.year} 年 {state.monthNumber} 月
            </strong>
            <span className="tw-rounded-lg tw-bg-action-soft tw-px-2 tw-py-1 tw-text-xs tw-text-action">
              今天
            </span>
          </div>
          <div className="tw-relative tw-grid tw-grid-cols-7 tw-gap-0.5 tw-p-1.5">
            {week.map((day, index) => {
              if (!day) return <span key={index} />;
              const today = day.date === state.today;
              const selected = day.date === state.selected.date;
              const rest = day.schedule.kind === 'holiday' || day.schedule.kind === 'weekend';
              return (
                <div
                  key={day.date}
                  className={
                    'tw-grid tw-min-h-9 tw-min-w-0 tw-content-center tw-justify-items-center tw-rounded-lg tw-px-0.5 ' +
                    (today ? 'is-today' : selected ? 'tw-bg-[var(--selected-bg)]' : '')
                  }
                >
                  <b
                    className={
                      'tw-text-sm tw-tabular-nums ' +
                      (selected ? 'tw-text-action' : rest ? 'tw-text-red' : '')
                    }
                  >
                    {day.day}
                  </b>
                  <span
                    className={
                      'lunar-day tw-w-full tw-truncate tw-text-center tw-text-[11px] ' +
                      (day.festivals.length
                        ? 'tw-text-[var(--purple)]'
                        : day.solarTerm
                          ? 'tw-text-green'
                          : selected
                            ? 'tw-text-[var(--selected-ink)]'
                            : 'tw-text-[var(--lunar-ink)]')
                    }
                  >
                    {caption(day)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {background?.strength && background.url && failedImage === background.url ? (
        <output className="tw-text-xs tw-text-secondary">
          在线图片暂时无法加载，预览显示主题底色。
        </output>
      ) : null}
      {issues.length ? (
        <output className="tw-text-xs tw-text-yellow">
          部分色彩组合的对比度较低，可调整底色或主要文字颜色。
        </output>
      ) : null}
    </div>
  );
}

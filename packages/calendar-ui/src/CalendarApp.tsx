import { daysBetween, type CalendarDay } from '@i-calendar/core';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useSyncExternalStore,
  type KeyboardEvent,
  type SVGProps,
  type ReactNode,
} from 'react';

import { version as appVersion } from '../../../package.json';
import { website as appWebsite } from '../../../release/config.json';
import { AlmanacContent } from './Almanac.js';
import { AppUpdateNotice, AppUpdateSection } from './AppUpdateSection.js';
import { CalendarButton } from './CalendarButton.js';
import { CalendarContextMenu } from './CalendarContextMenu.js';
import { CalendarSegmented } from './CalendarSegmented.js';
import { CalendarSelect } from './CalendarSelect.js';
import { CalendarSwitch } from './CalendarSwitch.js';
import { CalendarTabs } from './CalendarTabs.js';
import { deriveColorTokens } from './color-theme.js';
import { DailySign } from './DailySign.js';
import { DateCalculator } from './DateCalculator.js';
import { formControlVariables } from './form-theme.js';
import { LaunchAtLoginSettings } from './LaunchAtLoginSettings.js';
import { MenuClockSettings } from './MenuClockSettings.js';
import type { CalendarPreferences } from './platform.js';
import type { CalendarController, CalendarSnapshot, SettingsTab } from './store.js';
import { SunlightSettings, SunlightSummary, useSunlightLocation } from './Sunlight.js';
import { themeBackground } from './theme-image.js';
import { activeTheme } from './theme-library.js';
import { ThemeBackdrop } from './ThemeBackdrop.js';
import { ThemeSettings } from './ThemeSettings.js';

import './calendar.css';

type IconName = 'calculator' | 'settings' | 'left' | 'right' | 'external' | 'close';
function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    calculator: (
      <>
        <rect
          x="4.5"
          y="2.5"
          width="15"
          height="19"
          rx="3"
        />
        <path d="M8 7.5h8M8.5 12h1m4 0h1m-6 4h1m4 0h1" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-.5 2.2-2 .9-2-.7L2 10l1.7 1.5v2L2 15l2.5 4.5 2-.7 2 .9L9 22h6l.5-2.3 2-.9 2 .7L22 15l-1.7-1.5v-2L22 10l-2.5-4.6-2 .7-2-.9L15 3Z" />
        <circle
          cx="12"
          cy="12.5"
          r="3.1"
        />
      </>
    ),
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14" />
        <path d="M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
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
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const years = Array.from({ length: 200 }, (_, index) => ({
  value: 1901 + index,
  label: `${1901 + index}年`,
}));
const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}月`,
}));

function scheduleLabel(day: CalendarDay) {
  if (day.schedule.coverage === 'unavailable') return '调休未收录';
  return { holiday: '放假', 'makeup-workday': '补班日', weekend: '周末', weekday: '工作日' }[
    day.schedule.kind
  ];
}

function dayLabel(day: CalendarDay) {
  return `${day.date}，农历${day.lunar.monthName}${day.lunar.dayName}，${[...day.festivals, day.solarTerm].filter(Boolean).join('，')}，${scheduleLabel(day)}`;
}

function detailLabel(day: CalendarDay) {
  return (
    day.festivals[0] ??
    day.solarTerm ??
    (day.lunar.day === 1 ? day.lunar.monthName : day.lunar.dayName)
  );
}

function Feedback({
  controller,
  state,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
}) {
  if (!state.error && !state.notice) return null;
  return (
    <div
      className={`feedback tw-flex tw-items-center tw-gap-[5px] tw-pt-2.5 tw-text-[length:11px] tw-leading-[1.7] tw-text-green tw-overflow-anywhere [&>span]:tw-flex-1 ${state.error ? 'feedback-error tw-text-red' : ''}`}
      role={state.error ? 'alert' : 'status'}
    >
      <span>{state.error ?? state.notice}</span>
      <CalendarButton
        appearance="icon"
        className="icon-button app:tw-inline-flex app:tw-h-7 app:tw-w-7 app:tw-shrink-0 app:tw-items-center app:tw-justify-center app:tw-rounded-[var(--form-radius)] app:tw-p-[5px] app:tw-text-secondary coarse:app:tw-min-h-11 coarse:app:tw-min-w-11"
        aria-label="关闭提示"
        onClick={() => controller.dismissError()}
        icon={<Icon name="close" />}
      />
    </div>
  );
}

/** 三端共用日历视图；平台壳不复制月历、节日或设置界面。 */
export function CalendarApp({ controller }: { controller: CalendarController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const daysFromToday = daysBetween(state.today, state.selected.date);
  const isMac = controller.platform.kind === 'macos';
  useSunlightLocation(controller, state.ready, state.preferences.sunlight.mode);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [increasedContrast, setIncreasedContrast] = useState(
    () => window.matchMedia('(prefers-contrast: more)').matches,
  );
  const focusAfterNavigation = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const animatedMonth = useRef(state.year * 12 + state.monthNumber);
  const gear = useRef<HTMLButtonElement>(null);
  const previousPanel = useRef(state.panel);
  const container = useRef<HTMLElement>(null);
  const editingTheme = state.themeEdit !== null;
  const calculatorFromSettings =
    state.panel === 'calculator' && state.calculatorOrigin === 'settings';
  const appearance = state.themeEdit?.appearance ?? state.preferences.appearance;
  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
  const theme = state.themeEdit?.theme ?? activeTheme(state.preferences.themes);
  const palette = theme.palettes[dark ? 'dark' : 'light'];
  const background = controller.platform.kind === 'web' ? undefined : themeBackground(theme);
  const colors = useMemo(
    () => deriveColorTokens(palette, increasedContrast, dark),
    [palette, dark, increasedContrast],
  );

  useEffect(() => {
    const month = state.year * 12 + state.monthNumber;
    const offset = Math.sign(month - animatedMonth.current) * 6;
    animatedMonth.current = month;
    if (
      controller.platform.kind !== 'web' ||
      state.panel !== 'calendar' ||
      !grid.current ||
      !offset
    )
      return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const animation = grid.current.animate(
      [
        { opacity: 0.55, transform: `translateX(${offset}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    return () => animation.cancel();
  }, [controller, state.year, state.monthNumber, state.panel]);

  useEffect(() => {
    const element = container.current;
    const resize = controller.platform.setPopupHeight;
    if (!element || !resize) return;
    let frame = 0;
    let previousHeight = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // 日历按完整内容展开；设置和工具页保留稳定高度和自身的内容滚动。
        const height = state.panel !== 'calendar' ? 660 : Math.ceil(element.scrollHeight);
        if (height === previousHeight) return;
        previousHeight = height;
        void resize(height).catch((error: unknown) => console.error('悬浮窗高度调整失败', error));
      });
    };
    const observer = new ResizeObserver(measure);
    const observeContent = () => {
      observer.disconnect();
      observer.observe(element);
      for (const child of element.children) observer.observe(child);
      measure();
    };
    // 详情卡片可挂载或移除；重新观察直接子元素，避免窗口受限时漏掉高度变化。
    const structure = new MutationObserver(observeContent);
    structure.observe(element, { childList: true });
    observeContent();
    return () => {
      structure.disconnect();
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [controller, state.panel]);

  useEffect(() => {
    void controller.initialize();
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(query.matches);
    query.addEventListener('change', changed);
    const contrast = window.matchMedia('(prefers-contrast: more)');
    const contrastChanged = () => setIncreasedContrast(contrast.matches);
    contrast.addEventListener('change', contrastChanged);
    const refresh = () => {
      if (document.visibilityState !== 'hidden') controller.refreshToday();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      query.removeEventListener('change', changed);
      contrast.removeEventListener('change', contrastChanged);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [controller]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const variables = { ...colors, ...formControlVariables };
    for (const [name, value] of Object.entries(variables))
      document.documentElement.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(variables))
        document.documentElement.style.removeProperty(name);
    };
  }, [dark, colors]);

  useEffect(() => {
    if (!state.ready || !state.preferences.automaticAppUpdates || !controller.platform.appUpdater)
      return;
    const check = () => {
      void controller.appUpdates.check(true);
    };
    check();
    const interval = window.setInterval(check, 60 * 60 * 1000);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', check);
    };
  }, [controller, state.ready, state.preferences.automaticAppUpdates]);

  useEffect(() => {
    if (state.panel === 'calendar' && previousPanel.current !== 'calendar')
      gear.current?.focus({ preventScroll: editingTheme });
    previousPanel.current = state.panel;
  }, [editingTheme, state.panel]);

  useEffect(() => {
    if (focusAfterNavigation.current) {
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${state.selected.date}"]`)
        ?.focus();
      focusAfterNavigation.current = false;
    }
  });

  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.key !== 'Escape' &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement ||
            event.target instanceof HTMLTextAreaElement ||
            (event.target instanceof Element &&
              !!event.target.closest('[role="combobox"], [data-calendar-popup]'))))
      )
        return;
      if (event.key === 'Escape') {
        if (editingTheme) {
          if (state.panel === 'calendar') controller.resumeThemeEdit();
          else controller.cancelThemeEdit();
        } else if (state.panel === 'calculator') {
          controller.backFromCalculator();
        } else if (state.panel === 'settings') {
          controller.showSettings(false);
        } else void controller.platform.close?.();
      } else if (state.panel === 'calendar') {
        if (event.key.toLowerCase() === 't') {
          event.preventDefault();
          focusAfterNavigation.current = true;
          controller.goToday();
        } else if (event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault();
          focusAfterNavigation.current = true;
          controller.shiftMonth(event.key === 'PageUp' ? -1 : 1);
        }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [controller, editingTheme, state.panel]);

  function moveInGrid(event: KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in directions) {
      event.preventDefault();
      focusAfterNavigation.current = true;
      controller.moveSelection(directions[event.key]!);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusAfterNavigation.current = true;
      controller.selectWeekEdge(event.key === 'End');
    }
  }

  const displayedWeekdays =
    state.preferences.weekStartsOn === 1 ? weekdays : ['日', ...weekdays.slice(0, 6)];
  const settingsButton = editingTheme ? (
    <CalendarButton
      ref={gear}
      appearance="text"
      className="app:tw-shrink-0 app:tw-whitespace-nowrap app:tw-text-xs"
      onClick={() => controller.resumeThemeEdit()}
    >
      继续编辑
    </CalendarButton>
  ) : (
    <CalendarButton
      ref={gear}
      appearance="icon"
      className="icon-button app:tw-inline-flex app:tw-h-7 app:tw-w-7 app:tw-shrink-0 app:tw-items-center app:tw-justify-center app:tw-rounded-[var(--form-radius)] app:tw-p-[5px] app:tw-text-secondary coarse:app:tw-min-h-11 coarse:app:tw-min-w-11"
      aria-label="设置与调休数据"
      title="设置与调休数据"
      onClick={() => controller.showSettings()}
      icon={<Icon name="settings" />}
    />
  );

  return (
    <article
      ref={container}
      className="calendar-app tw-grid tw-w-[min(400px,_100%)] tw-min-w-0 tw-max-w-full tw-gap-3 tw-text-[length:13px] tw-text-ink mac:tw-max-h-[100vh] mac:tw-w-full mac:tw-content-start mac:tw-gap-2 mac:tw-overflow-y-auto mac:tw-p-2 web:tw-relative web:tw-isolate web:tw-mx-auto web:tw-w-full web:tw-gap-0 web:tw-rounded-[22px] web:tw-border-0 web:data-[panel=calendar]:tw-bg-panel web:desktop:tw-grid-cols-[minmax(0,_1fr)_304px]"
      data-panel={state.panel}
      data-theme-photo={background?.strength ? true : undefined}
      data-show-lunar-details={state.preferences.showLunarDetails}
      aria-label="i日历"
      aria-busy={!state.ready}
      data-platform={controller.platform.kind}
    >
      <ThemeBackdrop
        background={background}
        dark={dark}
        onImageStatus={controller.reportThemeImageStatus}
      />
      {state.panel === 'settings' || editingTheme || calculatorFromSettings ? (
        <Settings
          controller={controller}
          state={state}
          dark={dark}
          increasedContrast={increasedContrast}
        />
      ) : null}
      {state.panel === 'calculator' ? (
        <DateCalculator
          holidays={controller.holidays}
          selectedDate={state.selected.date}
          today={state.today}
          backLabel={calculatorFromSettings ? '返回设置' : '返回日历'}
          onBack={() => controller.backFromCalculator()}
          onViewDate={(date) => {
            focusAfterNavigation.current = true;
            controller.selectDate(date);
            controller.showCalculator(false);
          }}
        />
      ) : state.panel === 'calendar' ? (
        <>
          <section
            className="month-panel tw-relative tw-min-w-0 tw-rounded-[22px] tw-bg-panel tw-p-[18px] mac:tw-rounded-[18px] mac:tw-px-3 mac:tw-py-2.5 web:tw-bg-transparent web:desktop:tw-p-7 compact:tw-rounded-[20px] compact:tw-px-3 compact:tw-py-4"
            aria-label="月历"
          >
            {controller.platform.kind === 'web' ? (
              <div className="month-banner-title tw-mb-5 tw-flex tw-items-baseline tw-gap-3 tw-px-1 compact:tw-mb-3">
                <span
                  aria-hidden="true"
                  className="tw-text-[32px] tw-font-semibold tw-tabular-nums tw-leading-none tw-tracking-tight compact:tw-text-2xl"
                >
                  {String(state.monthNumber).padStart(2, '0')}
                </span>
                <span className="tw-text-xs tw-font-medium tw-text-secondary">
                  {state.year} 年 · {state.monthNumber} 月
                </span>
              </div>
            ) : null}
            <div className="month-toolbar tw-mb-3 tw-flex tw-items-center tw-justify-between tw-gap-2 tw-text-[length:13px] tw-font-medium compact:coarse:tw-flex-wrap tiny:coarse:tw-gap-0 [&_svg]:tw-h-[13px] [&_svg]:tw-w-[13px]">
              <h1
                className="sr-only"
                id="month-title"
              >
                {state.year}年{state.monthNumber}月
              </h1>
              <div className="month-heading tw-flex tw-min-w-0 tw-items-center tw-gap-1 tiny:coarse:tw-gap-0">
                <CalendarSelect
                  className="year-control tw-w-[78px]"
                  label="年份"
                  value={state.year}
                  options={years}
                  onChange={(year) => controller.jump(year, state.monthNumber)}
                />
                <nav
                  className="month-controls tw-flex tw-shrink-0 tw-items-center tw-gap-1 coarse:tw-gap-0.5 tiny:coarse:tw-gap-0"
                  aria-label="切换月份"
                >
                  <CalendarButton
                    appearance="toolbar"
                    className="tool-button app:tw-relative app:tw-h-7 app:tw-w-7 app:tw-min-w-7 app:tw-shrink-0 app:tw-rounded-[8px] app:tw-border-0 app:tw-bg-transparent app:tw-p-0 app:tw-text-[length:13px] app:tw-font-medium app:tw-leading-[20px] app:tw-text-ink app:tw-shadow-none coarse:app:tw-min-h-11 coarse:app:tw-min-w-11"
                    aria-label="上个月"
                    title="上个月（PageUp）"
                    disabled={state.year === 1901 && state.monthNumber === 1}
                    icon={
                      <Icon
                        name="left"
                        viewBox="4 3 16 18"
                      />
                    }
                    onClick={() => controller.shiftMonth(-1)}
                  />
                  <CalendarSelect
                    className="month-control tw-w-[62px]"
                    label="月份"
                    value={state.monthNumber}
                    options={months}
                    onChange={(month) => controller.jump(state.year, month)}
                  />
                  <CalendarButton
                    appearance="toolbar"
                    className="tool-button app:tw-relative app:tw-h-7 app:tw-w-7 app:tw-min-w-7 app:tw-shrink-0 app:tw-rounded-[8px] app:tw-border-0 app:tw-bg-transparent app:tw-p-0 app:tw-text-[length:13px] app:tw-font-medium app:tw-leading-[20px] app:tw-text-ink app:tw-shadow-none coarse:app:tw-min-h-11 coarse:app:tw-min-w-11"
                    aria-label="下个月"
                    title="下个月（PageDown）"
                    disabled={state.year === 2100 && state.monthNumber === 12}
                    icon={
                      <Icon
                        name="right"
                        viewBox="4 3 16 18"
                      />
                    }
                    onClick={() => controller.shiftMonth(1)}
                  />
                </nav>
              </div>
              <div className="tw-ml-auto tw-flex tw-shrink-0 tw-items-center tw-gap-1 web:compact:coarse:tw-absolute web:compact:coarse:tw-right-3 web:compact:coarse:tw-top-2 tiny:coarse:tw-gap-0">
                <CalendarButton
                  appearance="accent"
                  className="today-button app:tw-relative app:tw-h-7 app:tw-w-11 app:tw-min-w-11 app:tw-shrink-0 app:tw-whitespace-nowrap app:tw-rounded-[8px] app:tw-border-0 app:tw-bg-transparent app:tw-p-0 app:tw-text-[length:13px] app:tw-font-medium app:tw-leading-[20px] app:tw-text-action app:tw-shadow-none coarse:app:tw-min-h-11 coarse:app:tw-min-w-11"
                  onClick={() => controller.goToday()}
                  title="回到今天（T）"
                >
                  今天
                </CalendarButton>
                {isMac || editingTheme ? settingsButton : null}
              </div>
            </div>
            <div
              className="calendar-grid"
              role="grid"
              aria-labelledby="month-title"
              aria-rowcount={7}
              aria-colcount={7}
              ref={grid}
            >
              <div
                className="week-row tw-mb-2 tw-grid tw-grid-cols-[repeat(7,_minmax(0,_1fr))] tw-gap-[5px] mac:tw-mb-1.5 web:desktop:tw-mb-3.5 web:desktop:tw-gap-2 tiny:coarse:tw-gap-[3px] [&>span]:tw-text-center [&>span]:tw-text-[length:12px] [&>span]:tw-font-medium [&>span]:tw-leading-[22px] [&>span]:tw-text-[var(--weekday-ink)] [&_.weekend-heading]:tw-text-red"
                role="row"
              >
                {displayedWeekdays.map((day) => (
                  <span
                    role="columnheader"
                    key={day}
                    className={day === '六' || day === '日' ? 'weekend-heading' : ''}
                  >
                    {day}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, row) => (
                <div
                  className="date-row tw-grid tw-grid-cols-[repeat(7,_minmax(0,_1fr))] tw-gap-[5px] web:desktop:tw-gap-2 tiny:coarse:tw-gap-[3px] [&+.date-row]:tw-mt-[5px] mac:[&+.date-row]:tw-mt-0.5 web:desktop:[&+.date-row]:tw-mt-2 [&>[role='gridcell']]:tw-min-w-0"
                  role="row"
                  key={row}
                >
                  {state.month.cells.slice(row * 7, row * 7 + 7).map((day, index) =>
                    day ? (
                      <div
                        role="gridcell"
                        key={day.date}
                        aria-selected={state.selected.date === day.date}
                      >
                        <button
                          type="button"
                          className={[
                            'day-cell tw-w-full tw-h-[46px] tw-relative tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-0.5 tw-py-[3px] tw-px-0 tw-border-0 tw-rounded-[12px] tw-bg-transparent tw-text-ink [&_.term-label]:tw-text-green [&_.festival-label]:tw-text-[var(--purple)] web:desktop:tw-h-[clamp(52px,_7vh,_72px)] mac:tw-h-10 mac:tw-py-0.5 mac:tw-px-0 mac:tw-rounded-[10px] mac:tw-gap-px coarse:tw-h-12 web:desktop:short:tw-gap-px web:desktop:short:tw-py-0.5 web:desktop:short:tw-px-0',
                            day.month !== state.monthNumber ? 'outside-month' : '',
                            state.selected.date === day.date ? 'selected' : '',
                            state.today === day.date ? 'is-today' : '',
                            day.schedule.kind === 'holiday' ||
                            (day.weekday >= 6 && day.schedule.kind !== 'makeup-workday')
                              ? 'rest-day'
                              : '',
                            day.schedule.kind === 'holiday' ? 'holiday-day' : '',
                            day.schedule.kind === 'makeup-workday' ? 'makeup-day' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-label={dayLabel(day)}
                          aria-current={state.today === day.date ? 'date' : undefined}
                          tabIndex={state.selected.date === day.date ? 0 : -1}
                          data-date={day.date}
                          title={dayLabel(day)}
                          onClick={() => controller.selectDate(day.date)}
                          onKeyDown={moveInGrid}
                        >
                          <span className="solar-day tw-text-[length:19px] tw-font-semibold tw-tabular-nums tw-leading-[22px] tw-tracking-[-0.025em] mac:tw-text-[length:18px] mac:tw-leading-[21px] web:desktop:tw-text-[length:22px] web:desktop:tw-leading-[27px] tiny:coarse:tw-text-[length:18px] web:desktop:short:tw-text-[length:19px] web:desktop:short:tw-leading-[23px]">
                            {day.day}
                          </span>
                          <span
                            className={`lunar-day tw-max-w-full tw-overflow-hidden tw-text-ellipsis tw-whitespace-nowrap tw-text-[length:11px] tw-leading-[14px] tw-text-[var(--lunar-ink)] web:desktop:tw-text-[length:12px] web:desktop:tw-leading-[17px] web:desktop:short:tw-shrink-0 web:desktop:short:tw-text-[length:11px] web:desktop:short:tw-leading-[14px] ${day.festivals.length ? 'festival-label' : day.solarTerm ? 'term-label' : ''}`}
                          >
                            {detailLabel(day)}
                          </span>
                          {day.schedule.kind === 'holiday' ||
                          day.schedule.kind === 'makeup-workday' ? (
                            <span
                              className={`day-mark tw-absolute -tw-top-0.5 tw-right-px tw-rounded-[4px] tw-bg-red tw-px-0.5 tw-py-px tw-text-[length:11px] tw-font-semibold tw-leading-[12px] tw-text-surface ${day.schedule.kind === 'makeup-workday' ? 'makeup' : ''}`}
                              aria-hidden="true"
                            >
                              {day.schedule.kind === 'holiday' ? '休' : '班'}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    ) : (
                      <span
                        key={`empty-${index}`}
                        role="gridcell"
                        className="empty-day tw-h-[46px] tw-w-full mac:tw-h-10 mac:tw-gap-px mac:tw-rounded-[10px] mac:tw-px-0 mac:tw-py-0.5 web:desktop:tw-h-[clamp(52px,_7vh,_72px)] coarse:tw-h-12"
                        aria-label="日期范围之外"
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
            {state.month.coverage === 'unavailable' ? (
              <p className="missing-schedule-note tw-mx-0 tw-mb-0 tw-mt-[11px] tw-text-[length:11px] tw-leading-[18px] tw-text-yellow mac:tw-mt-2 web:desktop:tw-mt-[17px]">
                本年调休未收录
              </p>
            ) : null}
            {!state.preferences.showLunarDetails ? (
              <Feedback
                controller={controller}
                state={state}
              />
            ) : null}
          </section>
          {state.preferences.showLunarDetails ? (
            <aside
              className="detail-panel tw-min-w-0 tw-rounded-[22px] tw-bg-panel tw-px-[18px] tw-py-3 mac:tw-rounded-[18px] mac:tw-px-3 mac:tw-py-2.5 web:tw-rounded-none web:tw-border-0 web:tw-border-t web:tw-border-solid web:tw-border-line web:tw-bg-transparent web:desktop:tw-flex web:desktop:tw-flex-col web:desktop:tw-border-l-0 web:desktop:tw-border-t-0 web:desktop:tw-px-6 web:desktop:tw-py-7 compact:tw-rounded-[20px] compact:tw-px-3 compact:tw-py-3 web:compact:tw-rounded-none web:desktop:[&>*]:tw-shrink-0"
              aria-label="日期详情"
            >
              <CalendarContextMenu
                items={[
                  {
                    key: 'copy',
                    label: '复制日期与农历',
                    onSelect: () => {
                      void controller.copySelected();
                    },
                  },
                  ...(state.selected.schedule.sources[0]
                    ? [
                        {
                          key: 'source',
                          label: '查看放假安排来源',
                          onSelect: () => {
                            void controller.openSource(state.selected.schedule.sources[0]!);
                          },
                        },
                      ]
                    : []),
                ]}
              >
                <section
                  className="date-summary tw-relative tw-grid tw-min-h-[58px] tw-grid-cols-[50px_minmax(0,_1fr)] tw-items-center tw-gap-[4px_12px] web:desktop:tw-flex web:desktop:tw-flex-col web:desktop:tw-items-center web:desktop:tw-gap-2 web:desktop:tw-px-0 web:desktop:tw-pb-3 web:desktop:tw-pt-2 web:desktop:tw-text-center compact:tw-gap-2 coarse:tw-flex-wrap compact:coarse:tw-grid-cols-[44px_minmax(0,_1fr)] compact:coarse:tw-gap-[4px_8px]"
                  aria-label="所选日期"
                >
                  <div
                    className="date-leaf tw-relative tw-col-[1] tw-row-[1] tw-grid tw-h-[58px] tw-w-[50px] tw-shrink-0 tw-place-items-center tw-rounded-[13px] tw-bg-[var(--leaf)] tw-text-[var(--leaf-ink)] web:tw-bg-transparent web:tw-text-action web:desktop:tw-h-[94px] web:desktop:tw-w-[84px] web:desktop:tw-rounded-[19px] compact:tw-h-[54px] compact:tw-w-11 [&>span]:tw-pt-[5px] [&>span]:tw-text-[length:28px] [&>span]:tw-font-medium [&>span]:tw-tabular-nums [&>span]:tw-leading-[32px] web:desktop:[&>span]:tw-text-[length:72px] web:desktop:[&>span]:tw-font-light web:desktop:[&>span]:tw-leading-none"
                    aria-hidden="true"
                  >
                    <span key={state.selected.date}>{state.selected.day}</span>
                  </div>
                  <div className="date-detail tw-col-[2] tw-row-[1] tw-min-w-0 tw-flex-1 [&_h2>span:last-child]:tw-ml-1 [&_h2]:tw-m-0 [&_h2]:tw-whitespace-nowrap [&_h2]:tw-text-[length:13px] [&_h2]:tw-font-semibold [&_h2]:tw-leading-[18px] [&_h2]:tw-text-ink web:desktop:[&_h2]:tw-text-[length:14px] web:desktop:[&_h2]:tw-leading-[22px] compact:[&_h2]:tw-text-[length:12px] [&_p]:tw-m-0 [&_p]:tw-text-[length:11px] [&_p]:tw-leading-[17px] [&_p]:tw-text-secondary web:desktop:[&_p]:tw-text-[length:12px] web:desktop:[&_p]:tw-leading-[21px] compact:[&_p]:tw-text-[length:11px]">
                    <div
                      className={`date-heading tw-flex tw-flex-wrap tw-items-center tw-gap-[4px_8px] web:desktop:tw-justify-center ${daysFromToday === 0 ? 'tw-mb-1' : 'tw-mb-0'}`}
                    >
                      <h2>
                        <span className="detail-year tw-hidden web:desktop:tw-inline">
                          {state.selected.year}年
                        </span>
                        {state.selected.month}月{state.selected.day}日{' '}
                        <span>周{weekdays[state.selected.weekday - 1]}</span>
                      </h2>
                      {state.selected.solarTerm ? (
                        <span
                          className="date-event date-event-term tw-text-[length:11px] tw-font-medium tw-leading-[18px] tw-text-green tw-overflow-anywhere"
                          aria-label={`节气：${state.selected.solarTerm}`}
                        >
                          {state.selected.solarTerm}
                        </span>
                      ) : null}
                      {state.selected.festivals.map((festival) => (
                        <span
                          key={festival}
                          className="date-event date-event-festival tw-text-[length:11px] tw-font-medium tw-leading-[18px] tw-text-[var(--purple)] tw-overflow-anywhere"
                          aria-label={`节日：${festival}`}
                        >
                          {festival}
                        </span>
                      ))}
                      <strong
                        className={`schedule-badge tw-whitespace-nowrap tw-rounded-[6px] tw-bg-green-soft tw-px-1.5 tw-py-px tw-text-[length:11px] tw-font-medium tw-leading-[18px] tw-text-green schedule-${state.selected.schedule.coverage === 'unavailable' ? 'unknown' : state.selected.schedule.kind}`}
                      >
                        {scheduleLabel(state.selected)}
                      </strong>
                    </div>
                    {daysFromToday !== 0 ? (
                      <p className="date-distance tw-tabular-nums !tw-leading-4">
                        {daysFromToday > 0
                          ? `还有 ${daysFromToday} 天`
                          : `${Math.abs(daysFromToday)} 天前`}
                      </p>
                    ) : null}
                    <div className="lunar-summary tw-flex tw-flex-wrap tw-items-baseline tw-gap-[0_8px] tw-text-[length:11px] tw-leading-[17px] tw-text-secondary web:desktop:tw-justify-center web:desktop:tw-text-[length:12px] web:desktop:tw-leading-[21px] [&>p]:tw-whitespace-nowrap [&>p]:tw-text-[var(--lunar-ink)]">
                      <p>
                        农历{state.selected.lunar.monthName}
                        {state.selected.lunar.dayName}
                      </p>
                      <dl
                        className="almanac-pillars tw-m-0 tw-flex tw-flex-wrap tw-gap-[0_6px] [&>div]:tw-flex [&>div]:tw-items-baseline [&>div]:tw-gap-1.5 [&_dd]:tw-m-0 [&_dd]:tw-whitespace-nowrap [&_dd]:tw-font-normal [&_dd]:tw-text-ink"
                        aria-label="年月日干支"
                      >
                        {(
                          [
                            ['年干支', state.almanac.ganZhi.year, '年'],
                            ['月干支', state.almanac.ganZhi.month, '月'],
                            ['日干支', state.almanac.ganZhi.day, '日'],
                          ] as const
                        ).map(([label, value, suffix]) => (
                          <div key={label}>
                            <dt className="sr-only">{label}</dt>
                            <dd>
                              {value}
                              <span>{suffix}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <span className="date-traits tw-flex tw-flex-wrap tw-gap-[2px_8px] tw-text-[length:11px] tw-leading-[18px] tw-text-secondary web:desktop:tw-justify-center [&>span]:tw-whitespace-nowrap [&_b]:tw-font-medium [&_b]:tw-text-ink">
                      <span>
                        生肖 <b>{state.selected.lunar.zodiac}</b>
                      </span>
                      <span>
                        星座 <b>{state.selected.constellation}</b>
                      </span>
                    </span>
                  </div>
                </section>
              </CalendarContextMenu>
              <div className="almanac-inline tw-mt-2.5 tw-border-0 tw-border-t tw-border-solid tw-border-line web:desktop:tw-mt-0 web:desktop:tw-block web:desktop:tw-border-0 web:desktop:tw-border-t web:desktop:tw-border-solid web:desktop:tw-border-line web:desktop:tw-p-0">
                <SunlightSummary state={state} />
                <AlmanacContent almanac={state.almanac} />
                {state.selected.date === state.today && controller.platform.dailySign ? (
                  <DailySign
                    key={state.selected.date}
                    day={state.selected}
                    storage={controller.platform.dailySign}
                    canReset={controller.platform.development}
                  />
                ) : null}
              </div>
              <Feedback
                controller={controller}
                state={state}
              />
            </aside>
          ) : null}
          <AppUpdateNotice controller={controller} />
          {!isMac ? (
            <footer className="app-footer tw-col-[1_/_-1] tw-flex tw-min-h-7 tw-items-center tw-justify-between tw-gap-3 tw-px-3 tw-py-0 web:tw-border-0 web:tw-border-t web:tw-border-solid web:tw-border-line web:tw-px-5 web:tw-py-2">
              {controller.platform.kind === 'web' ? (
                <ul
                  aria-label="日历颜色说明"
                  className="tw-m-0 tw-flex tw-list-none tw-flex-wrap tw-gap-x-4 tw-gap-y-1 tw-p-0 tw-text-[11px] tw-text-secondary compact:tw-gap-x-2"
                >
                  {[
                    ['tw-bg-action', '今天 / 选中'],
                    ['tw-bg-red', '休假'],
                    ['tw-bg-green', '节气'],
                    ['tw-bg-yellow', '补班'],
                    ['tw-bg-[var(--purple)]', '节日'],
                  ].map(([color, label]) => (
                    <li
                      key={label}
                      className="tw-flex tw-items-center tw-gap-1.5"
                    >
                      <span
                        className={`tw-h-1.5 tw-w-1.5 tw-rounded-full ${color}`}
                        aria-hidden="true"
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="brand tw-flex tw-items-center tw-gap-[7px] tw-text-[length:13px] tw-font-semibold tw-tracking-[0.02em] web:desktop:tw-text-[length:14px] [&_img]:tw-block [&_img]:tw-h-[19px] [&_img]:tw-w-[19px]">
                  <img
                    src={new URL('./assets/logo.svg', import.meta.url).href}
                    width="19"
                    height="19"
                    alt=""
                  />
                  <span>i日历</span>
                </div>
              )}
              {editingTheme ? null : settingsButton}
            </footer>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

const settingsScroll =
  'settings-scroll tw-h-full tw-min-h-0 tw-overflow-y-auto tw-overscroll-contain tw-px-0.5 tw-py-0 [&>section:first-child]:tw-pt-2 [&>section:last-child]:tw-border-0 [&>section]:tw-border-0 [&>section]:tw-border-b [&>section]:tw-border-solid [&>section]:tw-border-line [&>section]:tw-px-0 [&>section]:tw-py-[18px] [&_.clock-format-error]:tw-mx-0 [&_.clock-format-error]:tw-mb-2 [&_.clock-format-error]:tw-mt-0 [&_.clock-format-error]:tw-block [&_.clock-format-error]:tw-text-[length:12px] [&_.clock-format-error]:tw-leading-[1.8] [&_.clock-format-error]:tw-text-red [&_.clock-help]:tw-text-[length:11px] [&_.setting-hint]:tw-text-[length:11px] [&_h2]:tw-mx-0 [&_h2]:tw-mb-[13px] [&_h2]:tw-mt-0 [&_h2]:tw-text-[length:13px] [&_h2]:tw-font-semibold [&_h2]:tw-leading-[20px] [&_p]:tw-mx-0 [&_p]:tw-mb-2 [&_p]:tw-mt-0 [&_p]:tw-text-[length:12px] [&_p]:tw-leading-[1.8] [&_p]:tw-text-[var(--hint-ink)]';

function Settings({
  controller,
  state,
  dark,
  increasedContrast,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
  dark: boolean;
  increasedContrast: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const calculatorEntry = useRef<HTMLButtonElement>(null);
  const restoreCalculatorFocus = useRef(false);
  const appearanceScroll = useRef<HTMLDivElement>(null);
  const editScrollTop = useRef(0);
  const visible = state.panel === 'settings';
  const appUpdate = useSyncExternalStore(
    controller.appUpdates.subscribe,
    controller.appUpdates.getSnapshot,
  );
  useLayoutEffect(() => {
    if (!visible) return;
    if (restoreCalculatorFocus.current) {
      restoreCalculatorFocus.current = false;
      calculatorEntry.current?.focus({ preventScroll: true });
      return;
    }
    back.current?.focus({ preventScroll: true });
    if (appearanceScroll.current) appearanceScroll.current.scrollTop = editScrollTop.current;
  }, [visible]);
  useEffect(() => {
    const input = file.current;
    const cancelled = () => {
      void controller.platform.setInteractionBusy?.(false);
    };
    input?.addEventListener('cancel', cancelled);
    return () => input?.removeEventListener('cancel', cancelled);
  }, [controller]);

  const interact = (value: boolean) => {
    void controller.platform.setInteractionBusy?.(value);
  };
  return (
    <section
      className={`settings-panel ${visible ? 'tw-flex' : 'tw-hidden'} tw-h-[min(640px,_calc(100svh_-_64px))] tw-min-h-0 tw-min-w-0 tw-flex-col tw-overflow-hidden tw-rounded-[22px] tw-bg-panel tw-p-5 mac:tw-h-full mac:tw-min-h-0 mac:tw-overflow-hidden mac:tw-rounded-[18px] mac:tw-p-3 compact:tw-h-[calc(100svh_-_24px)] mac:compact:tw-h-full`}
      aria-labelledby="settings-title"
    >
      <header className="settings-header tw-mb-3.5 tw-flex tw-min-h-[30px] tw-items-center tw-justify-between [&>.calendar-button]:tw-pl-0 [&>.calendar-button]:tw-text-action [&_h1]:tw-m-0 [&_h1]:tw-text-[length:15px] [&_h1]:tw-font-semibold">
        <CalendarButton
          ref={back}
          appearance="text"
          icon={<Icon name="left" />}
          disabled={state.themeEdit?.saving}
          onClick={() => {
            if (state.themeEdit) {
              editScrollTop.current = appearanceScroll.current?.scrollTop ?? 0;
              controller.showThemeCalendar();
            } else controller.showSettings(false);
          }}
        >
          {state.themeEdit ? '查看月历' : '返回日历'}
        </CalendarButton>
        <h1 id="settings-title">设置</h1>
      </header>
      <CalendarTabs<SettingsTab>
        className="settings-tabs"
        defaultValue="general"
        value={state.settingsTab}
        onValueChange={(tab) => controller.selectSettingsTab(tab)}
        items={[
          {
            key: 'general',
            label: '常规',
            children: (
              <div className={settingsScroll}>
                {controller.platform.kind === 'macos' ? (
                  <LaunchAtLoginSettings controller={controller.launchAtLogin} />
                ) : null}
                <section>
                  <h2>日历显示</h2>
                  <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
                    <label htmlFor="show-lunar-details">显示农历详情</label>
                    <CalendarSwitch
                      id="show-lunar-details"
                      checked={state.preferences.showLunarDetails}
                      aria-describedby="lunar-details-hint"
                      onChange={(showLunarDetails) => {
                        void controller.setPreferences({ showLunarDetails });
                      }}
                    />
                  </div>
                  <p id="lunar-details-hint">
                    显示日期、农历干支与黄历详情；月历中的农历不受影响。
                  </p>
                  <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
                    <span>每周开始于</span>
                    <CalendarSegmented
                      aria-label="每周开始于"
                      options={[
                        { label: '周一', value: 1 },
                        { label: '周日', value: 7 },
                      ]}
                      value={state.preferences.weekStartsOn}
                      onChange={(value) => {
                        void controller.setPreferences({ weekStartsOn: value as 1 | 7 });
                      }}
                    />
                  </div>
                </section>
              </div>
            ),
          },
          {
            key: 'appearance',
            label: '外观',
            children: (
              <div
                className={settingsScroll}
                ref={appearanceScroll}
                onScroll={(event) => {
                  if (visible && state.themeEdit)
                    editScrollTop.current = event.currentTarget.scrollTop;
                }}
              >
                <section className={state.themeEdit ? 'tw-hidden' : undefined}>
                  <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
                    <h2 className="!tw-mb-0">明暗模式</h2>
                    <CalendarSegmented
                      aria-label="明暗模式"
                      options={[
                        { label: '跟随系统', value: 'system' },
                        { label: '浅色', value: 'light' },
                        { label: '深色', value: 'dark' },
                      ]}
                      value={state.preferences.appearance}
                      onChange={(value) => {
                        void controller.setPreferences({
                          appearance: value as CalendarPreferences['appearance'],
                        });
                      }}
                    />
                  </div>
                </section>
                <ThemeSettings
                  controller={controller}
                  state={state}
                  dark={dark}
                  increasedContrast={increasedContrast}
                />
              </div>
            ),
          },
          {
            key: 'sunlight',
            label: '日出日落',
            children: (
              <div className={settingsScroll}>
                <SunlightSettings
                  controller={controller}
                  state={state}
                />
              </div>
            ),
          },
          ...(controller.platform.kind === 'macos'
            ? [
                {
                  key: 'menu-bar' as const,
                  label: '菜单栏',
                  children: (
                    <div className={settingsScroll}>
                      <MenuClockSettings
                        settings={state.preferences.menuClock}
                        onChange={(menuClock) => {
                          void controller.setPreferences({ menuClock });
                        }}
                      />
                    </div>
                  ),
                },
              ]
            : []),
          {
            key: 'data',
            label: '数据',
            children: (
              <div className={settingsScroll}>
                <section>
                  <h2>放假与调休</h2>
                  <p>已收录：{state.years.join('、')}年</p>
                  <p>
                    农历、节气和已收录的调休均可离线查询。放假安排根据全国统一通知整理，不包含个人排班及地方假期。
                  </p>
                  <div className="data-actions tw-mx-0 tw-mb-2.5 tw-mt-3.5 tw-flex tw-gap-[var(--form-gap)] coarse:tw-min-h-11 coarse:tw-items-center">
                    <CalendarButton
                      loading={state.updating}
                      disabled={!state.ready}
                      onClick={() => {
                        void controller.checkUpdates();
                      }}
                    >
                      检查调休更新
                    </CalendarButton>
                    <CalendarButton
                      disabled={state.updating || !state.ready}
                      onClick={() => {
                        interact(true);
                        file.current?.click();
                      }}
                    >
                      导入 JSON…
                    </CalendarButton>
                  </div>
                  <p className="setting-hint">只导入已核对来源的完整年度安排。</p>
                  {state.updatedAt ? (
                    <p className="setting-hint">
                      上次同步：
                      {new Intl.DateTimeFormat('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                        dateStyle: 'medium',
                      }).format(new Date(state.updatedAt))}
                    </p>
                  ) : null}
                </section>
              </div>
            ),
          },
          {
            key: 'about',
            label: '关于',
            children: (
              <div className={settingsScroll}>
                <section>
                  <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2.5">
                    <img
                      src={new URL('./assets/logo.svg', import.meta.url).href}
                      width="28"
                      height="28"
                      alt=""
                    />
                    <div>
                      <h2 className="!tw-m-0">i日历</h2>
                      <p className="!tw-m-0">版本 {appVersion}</p>
                    </div>
                  </div>
                  <p>免费、无广告的公农历日历。</p>
                  <p>
                    官网{' '}
                    <a
                      href={appWebsite}
                      className="tw-text-action tw-underline tw-underline-offset-2 tw-overflow-anywhere"
                      onClick={(event) => {
                        event.preventDefault();
                        void controller.openSource(appWebsite);
                      }}
                      onAuxClick={(event) => {
                        if (event.button !== 1) return;
                        event.preventDefault();
                        void controller.openSource(appWebsite);
                      }}
                    >
                      {appWebsite}
                    </a>
                  </p>
                </section>
                {controller.platform.kind === 'macos' ? (
                  <AppUpdateSection
                    controller={controller}
                    state={state}
                  />
                ) : null}
                <section>
                  <h2>数据来源</h2>
                  <button
                    type="button"
                    className="source-link tw-mb-3 tw-flex tw-items-center tw-gap-[7px] tw-border-0 tw-bg-transparent tw-p-0 tw-text-left tw-text-[length:12px] tw-leading-[19px] tw-text-action focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-offset-2 focus-visible:tw-outline-secondary coarse:tw-min-h-11"
                    onClick={() => {
                      void controller.openSource('https://github.com/NateScarlet/holiday-cn');
                    }}
                  >
                    国务院节假日通知 · holiday-cn{' '}
                    <Icon
                      name="external"
                      width="12"
                      height="12"
                    />
                  </button>
                  <button
                    type="button"
                    className="source-link tw-mb-3 tw-flex tw-items-center tw-gap-[7px] tw-border-0 tw-bg-transparent tw-p-0 tw-text-left tw-text-[length:12px] tw-leading-[19px] tw-text-action focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-offset-2 focus-visible:tw-outline-secondary coarse:tw-min-h-11"
                    onClick={() => {
                      void controller.openSource('https://github.com/6tail/lunar-typescript');
                    }}
                  >
                    农历与节气计算 · lunar-typescript{' '}
                    <Icon
                      name="external"
                      width="12"
                      height="12"
                    />
                  </button>
                  {state.selected.schedule.sources.map((source, index) => (
                    <button
                      type="button"
                      className="source-link tw-mb-3 tw-flex tw-items-center tw-gap-[7px] tw-border-0 tw-bg-transparent tw-p-0 tw-text-left tw-text-[length:12px] tw-leading-[19px] tw-text-action focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-offset-2 focus-visible:tw-outline-secondary coarse:tw-min-h-11"
                      key={source}
                      onClick={() => {
                        void controller.openSource(source);
                      }}
                    >
                      {state.selected.year}年放假安排来源
                      {state.selected.schedule.sources.length > 1 ? index + 1 : ''}{' '}
                      <Icon
                        name="external"
                        width="12"
                        height="12"
                      />
                    </button>
                  ))}
                  <p className="setting-hint">日期按北京时间计算 · 支持1901—2100年</p>
                </section>
                <section className="keyboard-help">
                  <h2>键盘操作</h2>
                  <p>方向键选择日期，PageUp / PageDown 切月，T 回到今天，Esc 返回或收起日历。</p>
                </section>
              </div>
            ),
          },
        ]}
      />
      <input
        ref={file}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="选择年度调休 JSON"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) {
            interact(false);
            return;
          }
          if (selected.size > 1_000_000) {
            controller.reportError('文件过大，请选择年度调休 JSON');
            event.target.value = '';
            interact(false);
            return;
          }
          void selected
            .text()
            .then((text) => controller.importDataset(text))
            .catch(() => controller.reportError('文件无法读取，请重新选择。'))
            .finally(() => {
              event.target.value = '';
              interact(false);
            });
        }}
      />
      <Feedback
        controller={controller}
        state={state}
      />
      {(!state.themeEdit || controller.platform.quit) && (
        <footer className="settings-actions tw-mt-3 tw-flex tw-shrink-0 tw-items-center tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-3">
          {!state.themeEdit ? (
            <CalendarButton
              ref={calculatorEntry}
              appearance="icon"
              className="coarse:tw-min-h-11 coarse:tw-min-w-11"
              aria-label="日期计算"
              title="日期计算"
              disabled={!state.ready}
              onClick={() => {
                restoreCalculatorFocus.current = true;
                controller.showCalculator(true, 'settings');
              }}
              icon={<Icon name="calculator" />}
            />
          ) : null}
          {controller.platform.quit ? (
            <CalendarButton
              className="tw-ml-auto"
              appearance="danger"
              disabled={['downloading', 'installing'].includes(appUpdate.phase)}
              onClick={() => {
                void controller.platform.quit?.();
              }}
            >
              退出i日历
            </CalendarButton>
          ) : null}
        </footer>
      )}
    </section>
  );
}

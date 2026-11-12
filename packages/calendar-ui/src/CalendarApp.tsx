import type { CalendarDay } from '@i-calendar/core';
import Button from 'antd/es/button';
import ConfigProvider from 'antd/es/config-provider';
import Dropdown from 'antd/es/dropdown';
import Segmented from 'antd/es/segmented';
import Switch from 'antd/es/switch';
import Tabs from 'antd/es/tabs';
import theme from 'antd/es/theme';
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useSyncExternalStore,
  type KeyboardEvent,
  type SVGProps,
  type ReactNode,
} from 'react';

import { version as appVersion } from '../../../package.json';
import { AlmanacContent } from './Almanac.js';
import { CalendarSelect } from './CalendarSelect.js';
import { colorThemes, resolveColorTheme } from './color-theme.js';
import { createFormTheme, formControlVariables } from './form-theme.js';
import { MenuClockSettings } from './MenuClockSettings.js';
import type { CalendarPreferences } from './platform.js';
import type { CalendarController, CalendarSnapshot } from './store.js';

import './calendar.css';
import './form-controls.css';

type IconName = 'settings' | 'left' | 'right' | 'external' | 'close';
function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
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
      className={`feedback ${state.error ? 'feedback-error' : ''}`}
      role={state.error ? 'alert' : 'status'}
    >
      <span>{state.error ?? state.notice}</span>
      <Button
        type="text"
        className="icon-button"
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
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [increasedContrast, setIncreasedContrast] = useState(
    () => window.matchMedia('(prefers-contrast: more)').matches,
  );
  const focusAfterNavigation = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLElement>(null);
  const dark =
    state.preferences.appearance === 'dark' ||
    (state.preferences.appearance === 'system' && systemDark);
  const colors = useMemo(
    () => resolveColorTheme(state.preferences, dark, increasedContrast),
    [state.preferences, dark, increasedContrast],
  );

  useEffect(() => {
    const element = container.current;
    const resize = controller.platform.setPopupHeight;
    if (!element || !resize) return;
    let frame = 0;
    let previousHeight = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // 日历按完整内容展开；设置保留稳定高度和自身的内容滚动。
        const height = state.panel === 'settings' ? 660 : Math.ceil(element.scrollHeight);
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

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const variables = { ...colors.tokens, ...formControlVariables };
    for (const [name, value] of Object.entries(variables))
      document.documentElement.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(variables))
        document.documentElement.style.removeProperty(name);
    };
  }, [dark, colors]);

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
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.key !== 'Escape' &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement ||
            event.target instanceof HTMLTextAreaElement))
      )
        return;
      if (event.key === 'Escape') {
        if (state.panel !== 'calendar') {
          controller.showSettings(false);
          requestAnimationFrame(() => gear.current?.focus());
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
  }, [controller, state.panel]);

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

  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        ...createFormTheme(colors.tokens),
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <article
        ref={container}
        className="calendar-app"
        data-panel={state.panel}
        data-show-lunar-details={state.preferences.showLunarDetails}
        aria-label="i日历"
        aria-busy={!state.ready}
        data-platform={controller.platform.kind}
      >
        {state.panel === 'settings' ? (
          <Settings
            controller={controller}
            state={state}
          />
        ) : (
          <>
            <section
              className="month-panel"
              aria-label="月历"
            >
              <div className="month-toolbar">
                <h1
                  className="sr-only"
                  id="month-title"
                >
                  {state.year}年{state.monthNumber}月
                </h1>
                <div className="month-heading">
                  <CalendarSelect
                    className="year-control"
                    label="年份"
                    value={state.year}
                    options={years}
                    onChange={(year) => controller.jump(year, state.monthNumber)}
                  />
                  <nav
                    className="month-controls"
                    aria-label="切换月份"
                  >
                    <Button
                      type="text"
                      className="tool-button"
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
                      className="month-control"
                      label="月份"
                      value={state.monthNumber}
                      options={months}
                      onChange={(month) => controller.jump(state.year, month)}
                    />
                    <Button
                      type="text"
                      className="tool-button"
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
                <Button
                  type="text"
                  className="today-button"
                  onClick={() => controller.goToday()}
                  title="回到今天（T）"
                >
                  今天
                </Button>
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
                  className="week-row"
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
                    className="date-row"
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
                              'day-cell',
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
                            <span className="solar-day">{day.day}</span>
                            <span
                              className={`lunar-day ${day.festivals.length ? 'festival-label' : day.solarTerm ? 'term-label' : ''}`}
                            >
                              {detailLabel(day)}
                            </span>
                            {day.schedule.kind === 'holiday' ||
                            day.schedule.kind === 'makeup-workday' ? (
                              <span
                                className={`day-mark ${day.schedule.kind === 'makeup-workday' ? 'makeup' : ''}`}
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
                          className="empty-day"
                          aria-label="日期范围之外"
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
              {state.month.coverage === 'unavailable' ? (
                <p className="missing-schedule-note">本年调休未收录</p>
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
                className="detail-panel"
                aria-label="日期详情"
              >
                <Dropdown
                  trigger={['contextMenu']}
                  menu={{
                    items: [
                      {
                        key: 'copy',
                        label: '复制日期与农历',
                        onClick: () => {
                          void controller.copySelected();
                        },
                      },
                      ...(state.selected.schedule.sources[0]
                        ? [
                            {
                              key: 'source',
                              label: '查看放假安排来源',
                              onClick: () => {
                                void controller.openSource(state.selected.schedule.sources[0]!);
                              },
                            },
                          ]
                        : []),
                    ],
                  }}
                >
                  <section
                    className="date-summary"
                    aria-label="所选日期"
                  >
                    <div
                      className="date-leaf"
                      aria-hidden="true"
                    >
                      <span key={state.selected.date}>{state.selected.day}</span>
                    </div>
                    <div className="date-detail">
                      <div className="date-heading">
                        <h2>
                          <span className="detail-year">{state.selected.year}年</span>
                          {state.selected.month}月{state.selected.day}日{' '}
                          <span>周{weekdays[state.selected.weekday - 1]}</span>
                        </h2>
                        {state.selected.solarTerm ? (
                          <span
                            className="date-event date-event-term"
                            aria-label={`节气：${state.selected.solarTerm}`}
                          >
                            {state.selected.solarTerm}
                          </span>
                        ) : null}
                        {state.selected.festivals.map((festival) => (
                          <span
                            key={festival}
                            className="date-event date-event-festival"
                            aria-label={`节日：${festival}`}
                          >
                            {festival}
                          </span>
                        ))}
                        <strong
                          className={`schedule-badge schedule-${state.selected.schedule.coverage === 'unavailable' ? 'unknown' : state.selected.schedule.kind}`}
                        >
                          {scheduleLabel(state.selected)}
                        </strong>
                      </div>
                      <div className="lunar-summary">
                        <p>
                          农历{state.selected.lunar.monthName}
                          {state.selected.lunar.dayName}
                        </p>
                        <dl
                          className="almanac-pillars"
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
                      <span className="date-traits">
                        <span>
                          生肖 <b>{state.selected.lunar.zodiac}</b>
                        </span>
                        <span>
                          星座 <b>{state.selected.constellation}</b>
                        </span>
                      </span>
                    </div>
                  </section>
                </Dropdown>
                <div className="almanac-inline">
                  <AlmanacContent almanac={state.almanac} />
                </div>
                <Feedback
                  controller={controller}
                  state={state}
                />
              </aside>
            ) : null}
            <footer className="app-footer tw-flex tw-items-center tw-justify-between">
              <div className="brand tw-flex tw-items-center">
                <img
                  src={new URL('./assets/logo.svg', import.meta.url).href}
                  width="19"
                  height="19"
                  alt=""
                />
                <span>i日历</span>
              </div>
              <Button
                ref={gear}
                type="text"
                className="icon-button"
                aria-label="设置与调休数据"
                title="设置与调休数据"
                onClick={() => controller.showSettings()}
                icon={<Icon name="settings" />}
              />
            </footer>
          </>
        )}
      </article>
    </ConfigProvider>
  );
}

function Settings({
  controller,
  state,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
}) {
  const file = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus();
  }, []);
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
      className="settings-panel"
      aria-labelledby="settings-title"
    >
      <header className="settings-header">
        <Button
          ref={back}
          type="text"
          icon={<Icon name="left" />}
          onClick={() => controller.showSettings(false)}
        >
          返回日历
        </Button>
        <h1 id="settings-title">设置</h1>
      </header>
      <Tabs
        className="settings-tabs"
        defaultActiveKey="general"
        animated={false}
        destroyOnHidden={false}
        tabBarGutter={12}
        indicator={{ size: 20, align: 'center' }}
        styles={{ indicator: { background: 'var(--ink)', height: 2, borderRadius: 2 } }}
        items={[
          {
            key: 'general',
            label: '常规',
            children: (
              <div className="settings-scroll">
                <section>
                  <h2>日历显示</h2>
                  <div className="setting-label">
                    <label htmlFor="show-lunar-details">显示农历详情</label>
                    <Switch
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
                  <div className="setting-label">
                    <span>每周开始于</span>
                    <Segmented
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
                  <div className="setting-label">
                    <span>外观</span>
                    <Segmented
                      aria-label="外观"
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
                <section>
                  <h2>配色</h2>
                  <div
                    className="palette-choices"
                    role="group"
                    aria-label="主题预设"
                  >
                    {colorThemes.map((preset) => (
                      <Button
                        key={preset.id}
                        className="palette-choice"
                        aria-pressed={state.preferences.colorTheme === preset.id}
                        onClick={() => {
                          void controller.setPreferences({
                            colorTheme: preset.id,
                            accentColor: null,
                          });
                        }}
                      >
                        <span
                          className="palette-swatch"
                          style={{ background: preset.canvas }}
                          aria-hidden="true"
                        >
                          <i style={{ background: preset.accent }} />
                        </span>
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                  <div className="accent-setting">
                    <label htmlFor="accent-color">强调色</label>
                    <span className="calendar-color">
                      <input
                        id="accent-color"
                        type="color"
                        value={
                          state.preferences.accentColor ??
                          colorThemes.find((item) => item.id === state.preferences.colorTheme)!
                            .accent
                        }
                        onChange={(event) => {
                          void controller.setPreferences({ accentColor: event.target.value });
                        }}
                        onFocus={() => interact(true)}
                        onBlur={() => interact(false)}
                      />
                    </span>
                    <span className="accent-value">
                      {(
                        state.preferences.accentColor ??
                        colorThemes.find((item) => item.id === state.preferences.colorTheme)!.accent
                      ).toUpperCase()}
                    </span>
                    <Button
                      type="text"
                      disabled={state.preferences.accentColor === null}
                      onClick={() => {
                        void controller.setPreferences({ accentColor: null });
                      }}
                    >
                      恢复默认
                    </Button>
                  </div>
                  <p>
                    强调色用于选中日期和操作，自动适配明暗外观。切换预设会恢复该主题的默认强调色。
                  </p>
                </section>
              </div>
            ),
          },
          ...(controller.platform.kind === 'macos'
            ? [
                {
                  key: 'menu-bar',
                  label: '菜单栏',
                  children: (
                    <div className="settings-scroll">
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
              <div className="settings-scroll">
                <section>
                  <h2>放假与调休</h2>
                  <p>已收录：{state.years.join('、')}年</p>
                  <p>
                    农历、节气和已收录的调休均可离线查询。放假安排根据全国统一通知整理，不包含个人排班及地方假期。
                  </p>
                  <div className="data-actions">
                    <Button
                      loading={state.updating}
                      disabled={!state.ready}
                      onClick={() => {
                        void controller.checkUpdates();
                      }}
                    >
                      检查调休更新
                    </Button>
                    <Button
                      disabled={state.updating || !state.ready}
                      onClick={() => {
                        interact(true);
                        file.current?.click();
                      }}
                    >
                      导入 JSON…
                    </Button>
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
              <div className="settings-scroll">
                <section>
                  <h2>i日历</h2>
                  <p>版本 {appVersion}</p>
                  <p>免费、无广告的公农历日历。</p>
                  {controller.platform.quit ? (
                    <Button
                      onClick={() => {
                        void controller.platform.quit?.();
                      }}
                    >
                      退出i日历
                    </Button>
                  ) : null}
                </section>
                <section>
                  <h2>数据来源</h2>
                  <button
                    type="button"
                    className="source-link"
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
                    className="source-link"
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
                      className="source-link"
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
    </section>
  );
}

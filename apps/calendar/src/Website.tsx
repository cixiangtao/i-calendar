import {
  activeTheme,
  CalendarApp,
  CalendarButton,
  themeBackground,
  ThemeBackdrop,
  type CalendarController,
} from '@i-calendar/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import mountainPreview from '../../../docs/images/theme-mountain.webp';
import logo from '../../../packages/calendar-ui/src/assets/logo.svg';
import releaseConfig from '../../../release/config.json';
import { AmbientOrbit } from './AmbientOrbit.js';

import './website.css';

const repository = `https://github.com/${releaseConfig.repository}`;
const release = `${repository}/releases/latest`;
const textLink =
  'tw-font-medium tw-text-action tw-underline-offset-4 hover:tw-underline focus-visible:tw-rounded-sm';
const contentWidth = 'tw-mx-auto tw-w-full tw-max-w-[1168px] tw-px-6 compact:tw-px-4';
const sectionTitle =
  'tw-m-0 tw-text-[length:clamp(1.625rem,1.3rem+1vw,2.25rem)] tw-font-semibold tw-leading-tight tw-tracking-tight';

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {down ? <path d="M12 4v16m-6-6 6 6 6-6" /> : <path d="M5 12h14m-6-6 6 6-6 6" />}
    </svg>
  );
}

/** 官网使用共享日历及其主题控制器，并在工作区之后介绍主题与 Mac 版。 */
export function Website({ controller }: { controller: CalendarController }) {
  const calendar = useRef<HTMLElement>(null);
  const [motion, setMotion] = useState(true);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(preference.matches);
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const background = themeBackground(
    state.themeEdit?.theme ?? activeTheme(state.preferences.themes),
  );
  const hasPhoto = Boolean(background?.strength);

  function showThemes() {
    if (state.themeEdit) controller.resumeThemeEdit();
    else controller.showSettings(true, 'appearance');
    calendar.current?.focus({ preventScroll: true });
    calendar.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="website tw-text-ink">
      <a
        href="#calendar"
        className="sr-only focus:tw-not-sr-only focus:tw-fixed focus:tw-left-4 focus:tw-top-4 focus:tw-z-50 focus:tw-rounded-lg focus:tw-bg-surface focus:tw-p-3 focus:tw-text-action"
      >
        跳到日历
      </a>
      <main>
        <div
          className="site-workspace tw-relative tw-isolate tw-overflow-hidden desktop:tw-min-h-[100svh]"
          data-theme-photo={hasPhoto || undefined}
        >
          {hasPhoto ? (
            <ThemeBackdrop
              background={background}
              onImageStatus={controller.reportThemeImageStatus}
            />
          ) : (
            <AmbientOrbit
              enabled={motion}
              date={state.selected.date}
            />
          )}
          <header
            className={`${contentWidth} tw-relative tw-flex tw-items-center tw-justify-between tw-gap-4 tw-py-5 compact:tw-py-3`}
          >
            <h1 className="site-theme-chrome tw-m-0 tw-flex tw-items-center tw-gap-2.5 tw-text-xl tw-font-semibold tw-tracking-tight">
              <img
                src={logo}
                width="32"
                height="32"
                alt=""
              />
              i日历
            </h1>
            <nav
              aria-label="官网导航"
              className="site-theme-chrome tw-flex tw-items-center tw-gap-6 tw-text-[13px] compact:tw-gap-4"
            >
              <a
                href="#themes"
                className="tw-inline-flex tw-min-h-11 tw-items-center tw-text-ink tw-no-underline hover:tw-text-action"
              >
                主题
              </a>
              <a
                href="#about"
                className="tw-inline-flex tw-min-h-11 tw-items-center tw-gap-1.5 tw-text-ink tw-no-underline hover:tw-text-action"
              >
                Mac 版 <Arrow down />
              </a>
            </nav>
          </header>
          <section
            id="calendar"
            ref={calendar}
            aria-label="在线日历"
            tabIndex={-1}
            className={`${contentWidth} site-calendar tw-relative tw-scroll-mt-3 tw-pb-10 compact:tw-pb-6`}
          >
            <CalendarApp controller={controller} />
            {state.panel === 'calendar' && (
              <div className="tw-mt-2 tw-flex tw-min-h-9 tw-flex-wrap tw-items-center tw-justify-between tw-gap-x-4 tw-px-1 tw-text-xs tw-text-ink">
                <p className="site-theme-chrome tw-m-0 tw-leading-5">
                  北京时间
                  <span className="tw-hidden desktop:tw-inline">
                    {' '}
                    · 方向键选日 · PageUp / PageDown 切月 · T 回到今天
                  </span>
                </p>
                {!hasPhoto && !reduced && (
                  <CalendarButton
                    appearance="text"
                    className="aria-pressed:before:tw-bg-action-soft"
                    aria-pressed={!motion}
                    onClick={() => setMotion((value) => !value)}
                  >
                    暂停光轨
                  </CalendarButton>
                )}
              </div>
            )}
          </section>
        </div>
        <section
          id="themes"
          aria-labelledby="themes-title"
          className="tw-scroll-mt-6 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-bg-surface"
        >
          <div
            className={`${contentWidth} tw-grid tw-items-center tw-gap-8 tw-py-12 desktop:tw-grid-cols-[minmax(0,5fr)_minmax(0,8fr)] desktop:tw-gap-14 desktop:tw-py-20`}
          >
            <div>
              <h2
                id="themes-title"
                className={sectionTitle}
              >
                日历主题
              </h2>
              <p className="tw-mb-0 tw-mt-4 tw-max-w-[31em] tw-text-sm tw-leading-7 tw-text-secondary">
                选清爽白、暖纸色等内置配色，也可以让山雾透过半透明卡片。每款主题都有浅色、深色两套配色，支持跟随系统。
              </p>
              <p className="tw-mb-5 tw-mt-3 tw-max-w-[31em] tw-text-sm tw-leading-7 tw-text-secondary">
                在外观设置里自定义颜色、透明度和背景图，切回月历实时预览。满意后可导出 ZIP
                主题包分享。
              </p>
              <CalendarButton
                appearance="neutral"
                onClick={showThemes}
              >
                打开主题设置 <Arrow />
              </CalendarButton>
            </div>
            <figure className="tw-m-0">
              <img
                src={mountainPreview}
                width="1280"
                height="800"
                alt="山雾主题的网页版日历，远山背景透过浅色月历与日期详情"
                className="tw-block tw-h-auto tw-w-full tw-rounded-2xl"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="tw-mt-3 tw-text-xs tw-text-secondary">山雾 · 浅色</figcaption>
            </figure>
          </div>
        </section>
        <section
          id="about"
          aria-labelledby="about-title"
          className="tw-scroll-mt-6"
        >
          <div
            className={`${contentWidth} tw-grid tw-items-start tw-gap-8 tw-py-12 desktop:tw-grid-cols-[minmax(0,5fr)_minmax(0,8fr)] desktop:tw-gap-14 desktop:tw-py-16`}
          >
            <div>
              <h2
                id="about-title"
                className={sectionTitle}
              >
                i日历 Mac 版
              </h2>
              <p className="tw-mb-5 tw-mt-4 tw-max-w-[31em] tw-text-sm tw-leading-7 tw-text-secondary">
                点一下菜单栏，就能展开月历。已收录的日期与放假调休支持离线查询，菜单栏也可顺手显示时间。
              </p>
              <a
                href={release}
                className="tw-box-border tw-inline-flex tw-min-h-11 tw-items-center tw-gap-3 tw-rounded-lg tw-bg-leaf tw-px-4 tw-text-sm tw-font-medium tw-text-[var(--leaf-ink)] tw-no-underline tw-transition-colors hover:tw-bg-leaf-hover active:tw-bg-leaf-active"
              >
                前往下载 Mac 版 <Arrow />
              </a>
              <p className="tw-mb-0 tw-mt-3 tw-max-w-[36em] tw-text-xs tw-leading-6 tw-text-secondary">
                Apple 芯片，macOS 13 或更新版本。应用采用 ad-hoc 本地签名，尚未通过 Apple
                公证。安装步骤见下载页。
              </p>
            </div>
            <div className="tw-grid tw-gap-5 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-5 desktop:tw-grid-cols-2 desktop:tw-border-t-0 desktop:tw-pt-2">
              <div>
                <h3 className="tw-m-0 tw-text-sm tw-font-semibold">放假与补班</h3>
                <p className="tw-mb-0 tw-mt-2 tw-text-[13px] tw-leading-6 tw-text-secondary">
                  按中国大陆全国统一安排标注。放假、补班和普通周末分别显示，未收录的年份会明确提示。
                </p>
              </div>
              <div>
                <h3 className="tw-m-0 tw-text-sm tw-font-semibold">农历与黄历</h3>
                <p className="tw-mb-0 tw-mt-2 tw-text-[13px] tw-leading-6 tw-text-secondary">
                  公农历和节气在本地计算。传统宜忌、干支和方位可在日期详情查看，数据来源见设置「关于」。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="tw-border-0 tw-border-t tw-border-solid tw-border-line">
        <div
          className={`${contentWidth} tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-4 tw-py-6 tw-text-xs tw-text-secondary`}
        >
          <span>i日历 · 免费、无广告、无需登录</span>
          <nav
            aria-label="项目链接"
            className="tw-flex tw-flex-wrap tw-gap-x-5 tw-gap-y-2"
          >
            <a
              href={repository}
              className={textLink}
            >
              GitHub
            </a>
            <a
              href={release}
              className={textLink}
            >
              版本说明
            </a>
            <a
              href="./third-party-licenses.txt"
              className={textLink}
            >
              许可声明
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import { CalendarApp, type CalendarController } from '@i-calendar/ui';
import type { ReactNode } from 'react';

import { version } from '../../../package.json';
import logo from '../../../packages/calendar-ui/src/assets/logo.svg';
import releaseConfig from '../../../release/config.json';

import './website.css';

const repository = `https://github.com/${releaseConfig.repository}`;
const release = `${repository}/releases/tag/v${version}`;
const download = `${repository}/releases/download/v${version}/i-calendar-${version}-mac-arm64.zip`;
const textLink = 'tw-text-action tw-underline-offset-4 hover:tw-underline';

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

function InfoRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tw-grid tw-gap-2 tw-border-0 tw-border-b tw-border-solid tw-border-line tw-py-5 first:tw-pt-0 last:tw-border-0 desktop:tw-grid-cols-[112px_minmax(0,1fr)] desktop:tw-gap-6">
      <dt className="tw-font-medium tw-text-ink">{title}</dt>
      <dd className="tw-m-0 tw-leading-7 tw-text-secondary">{children}</dd>
    </div>
  );
}

/** 官网围绕可操作日历组织内容，使用同一控制器及主题，不复制平台数据能力。 */
export function Website({ controller }: { controller: CalendarController }) {
  return (
    <div className="website tw-text-ink">
      <a
        href="#calendar"
        className="site-skip sr-only focus:tw-not-sr-only focus:tw-fixed focus:tw-left-4 focus:tw-top-4 focus:tw-z-50 focus:tw-rounded-lg focus:tw-bg-surface focus:tw-p-3 focus:tw-text-action"
      >
        跳到日历
      </a>
      <header className="tw-mx-auto tw-flex tw-w-full tw-max-w-[1168px] tw-items-center tw-justify-between tw-gap-4 tw-px-6 tw-py-6 compact:tw-px-4 compact:tw-py-5">
        <a
          href="#calendar"
          aria-label="i日历，回到日历"
          className="tw-flex tw-items-center tw-gap-3 tw-text-ink tw-no-underline"
        >
          <img
            src={logo}
            width="32"
            height="32"
            alt=""
          />
          <span className="tw-text-lg tw-font-semibold tw-tracking-tight">i日历</span>
          <span className="tw-ml-2 tw-hidden tw-border-0 tw-border-l tw-border-solid tw-border-line tw-pl-5 tw-text-xs tw-text-secondary sm:tw-inline">
            让日期，清晰可见。
          </span>
        </a>
        <nav
          aria-label="官网导航"
          className="tw-flex tw-items-center tw-gap-6 tw-text-xs"
        >
          <a
            href="#about"
            className="tw-inline-flex tw-min-h-11 tw-items-center tw-gap-2 tw-text-secondary tw-no-underline hover:tw-text-action"
          >
            关于与下载 <Arrow down />
          </a>
        </nav>
      </header>
      <main>
        <section
          id="calendar"
          aria-label="在线日历"
          tabIndex={-1}
          className="site-calendar tw-mx-auto tw-w-full tw-max-w-[1168px] tw-scroll-mt-4 tw-px-6 tw-pb-10 tw-pt-5 compact:tw-px-3 compact:tw-pb-6 compact:tw-pt-2"
        >
          <div className="tw-mb-5 tw-flex tw-items-end tw-justify-between tw-gap-4 tw-px-1">
            <div>
              <h1 className="tw-m-0 tw-text-2xl tw-font-semibold tw-tracking-tight compact:tw-text-xl">
                日子里的每一面。
              </h1>
              <p className="tw-mb-0 tw-mt-2 tw-text-xs tw-leading-6 tw-text-secondary">
                公历与农历，节气与休班，一眼看清。
              </p>
            </div>
            <span className="tw-hidden tw-pb-1 tw-text-xs tw-text-secondary sm:tw-inline">
              日历按北京时间 · 无需登录
            </span>
          </div>
          <CalendarApp controller={controller} />
          <p className="tw-mb-0 tw-mt-4 tw-text-center tw-text-[11px] tw-leading-5 tw-text-secondary">
            点击日期查看详情
            <span className="tw-hidden desktop:tw-inline">
              {' '}
              · 方向键选日 · PageUp / PageDown 切月 · T 回到今天
            </span>
          </p>
        </section>
        <section
          id="about"
          aria-labelledby="about-title"
          className="tw-scroll-mt-8 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-bg-surface"
        >
          <div className="tw-mx-auto tw-grid tw-max-w-[1168px] tw-gap-12 tw-px-6 tw-py-16 desktop:tw-grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desktop:tw-gap-20 compact:tw-px-5 compact:tw-py-10">
            <div>
              <h2
                id="about-title"
                className="tw-m-0 tw-max-w-[13em] tw-text-[32px] tw-font-semibold tw-leading-[1.45] tw-tracking-tight compact:tw-text-[26px]"
              >
                网页随手查，
                <br />
                也可以常驻菜单栏。
              </h2>
              <p className="tw-mb-7 tw-mt-5 tw-max-w-[34em] tw-text-sm tw-leading-7 tw-text-secondary">
                免费、无广告的公农历。Mac
                版让日历待在菜单栏，需要时轻轻一点。已收录的日期与调休数据支持离线查询。
              </p>
              <a
                href={download}
                className="site-download tw-inline-flex tw-min-h-12 tw-items-center tw-gap-7 tw-rounded-xl tw-bg-leaf tw-px-5 tw-py-3 tw-text-sm tw-font-medium tw-text-[var(--leaf-ink)] tw-no-underline tw-transition-colors hover:tw-bg-leaf-hover active:tw-bg-leaf-active"
              >
                下载 Mac 版 <Arrow down />
              </a>
              <p className="tw-mb-0 tw-mt-4 tw-text-xs tw-leading-6 tw-text-secondary">
                v{version} · Apple 芯片 · macOS 13 及以上
                <br />
                Intel 与 iOS 安装包尚未提供。
              </p>
              <p className="tw-mb-0 tw-mt-3 tw-max-w-[34em] tw-text-xs tw-leading-6 tw-text-secondary">
                Mac 版采用 ad-hoc 本地签名，尚未通过 Apple 公证。
                <a
                  href={release}
                  className={textLink}
                >
                  查看安装说明与版本更新
                </a>
              </p>
            </div>
            <dl className="tw-m-0 tw-text-[13px]">
              <InfoRow title="同一本日历">
                Mac 与网页版复用日历核心和界面。公农历、节日、二十四节气与黄历，在同一处查看。
              </InfoRow>
              <InfoRow title="休假与补班">
                根据中国大陆全国统一安排整理，常规周末与放假、补班分别标记。未收录年份会明确提示；个人排班以所在单位为准。
              </InfoRow>
              <InfoRow title="来源可追溯">
                调休来源与黄历计算口径可在日历设置中查看。历法在本地计算；黄历仅作传统文化参考，不同流派可能有差异。
              </InfoRow>
              <InfoRow title="开源，保持简单">
                项目以 MIT 许可证开源，无需注册账户。
                <a
                  href={repository}
                  className={textLink}
                >
                  在 GitHub 查看源码
                </a>
              </InfoRow>
            </dl>
          </div>
        </section>
      </main>
      <footer className="tw-mx-auto tw-flex tw-max-w-[1168px] tw-flex-wrap tw-items-center tw-justify-between tw-gap-4 tw-px-6 tw-py-7 tw-text-xs tw-text-secondary compact:tw-px-5">
        <span className="tw-inline-flex tw-items-center tw-gap-2">
          <img
            src={logo}
            width="20"
            height="20"
            alt=""
          />
          i日历 · 查日子，打开就好。
        </span>
        <nav
          aria-label="项目链接"
          className="tw-flex tw-gap-5"
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
      </footer>
    </div>
  );
}

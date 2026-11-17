import { useCallback, useSyncExternalStore, type Ref } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarSwitch } from './CalendarSwitch.js';
import { ReleaseNotesDisclosure } from './ReleaseNotesDisclosure.js';
import type { CalendarController, CalendarSnapshot } from './store.js';

/** 已发现的新版始终保留底部入口；稍后只隐藏横幅，检查或安装失败仍可进入重试。 */
export function AppUpdateButton({
  controller,
  ref,
}: {
  controller: CalendarController;
  ref?: Ref<HTMLButtonElement>;
}) {
  const update = useSyncExternalStore(
    controller.appUpdates.subscribe,
    controller.appUpdates.getSnapshot,
  );
  if (!update.release) return null;
  const label =
    update.phase === 'downloading' ? '下载中' : update.phase === 'installing' ? '安装中' : '更新';
  return (
    <CalendarButton
      ref={ref}
      appearance="text"
      aria-label={`查看 i日历 ${update.release.version} 更新`}
      title={`查看 i日历 ${update.release.version} 更新`}
      onClick={() => controller.showSettings(true, 'about')}
    >
      {label}
    </CalendarButton>
  );
}

/** 更新提醒只在发现新版时出现，安装前可先查看说明或稍后处理。 */
export function AppUpdateNotice({ controller }: { controller: CalendarController }) {
  const update = useSyncExternalStore(
    controller.appUpdates.subscribe,
    controller.appUpdates.getSnapshot,
  );
  if (!update.release || update.dismissed || update.phase !== 'available') return null;
  return (
    <aside
      className="application-update-notice tw-col-[1_/_-1] tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-[4px_8px] tw-rounded-[12px] tw-bg-action-soft tw-px-2.5 tw-py-1.5 tw-text-[length:12px]"
      aria-live="polite"
    >
      <span>i日历 {update.release.version} 已可更新</span>
      <div className="application-update-actions tw-flex tw-flex-wrap tw-items-center tw-gap-[var(--form-gap)]">
        <CalendarButton
          appearance="text"
          onClick={() => controller.showSettings(true, 'about')}
        >
          查看更新
        </CalendarButton>
        <CalendarButton
          appearance="text"
          onClick={() => controller.appUpdates.defer()}
        >
          稍后
        </CalendarButton>
      </div>
    </aside>
  );
}

export function AppUpdateSection({
  controller,
  state,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
}) {
  const update = useSyncExternalStore(
    controller.appUpdates.subscribe,
    controller.appUpdates.getSnapshot,
  );
  const openReleaseLink = useCallback(
    (url: string) => {
      void controller.openSource(url);
    },
    [controller],
  );
  const busy = ['checking', 'downloading', 'installing'].includes(update.phase);
  const unavailable = update.phase === 'unavailable';
  const progress = update.progress;
  const percentage = progress?.total
    ? Math.min(100, Math.floor((progress.downloaded / progress.total) * 100))
    : undefined;
  return (
    <section
      className="application-update-section [&_.application-update-error]:tw-mt-2 [&_.application-update-error]:tw-text-red [&_.application-update-version]:tw-mt-2.5 [&_.application-update-version]:tw-font-medium [&_.application-update-version]:tw-text-ink"
      aria-label="应用更新"
    >
      <h2>应用更新</h2>
      <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
        <label htmlFor="automatic-app-updates">自动检查新版本</label>
        <CalendarSwitch
          id="automatic-app-updates"
          checked={state.preferences.automaticAppUpdates}
          onChange={(automaticAppUpdates) => {
            void controller.setPreferences({ automaticAppUpdates });
          }}
        />
      </div>
      <p>自动检查，确认后下载并安装。安装完成后会重新启动i日历。</p>
      {unavailable ? <p>当前为开发预览，自动更新将在正式发布后启用。</p> : null}
      <div className="application-update-actions tw-flex tw-flex-wrap tw-items-center tw-gap-[var(--form-gap)]">
        <CalendarButton
          disabled={unavailable || busy}
          loading={update.phase === 'checking'}
          onClick={() => {
            void controller.appUpdates.check();
          }}
        >
          检查新版本
        </CalendarButton>
        {update.release ? (
          <CalendarButton
            appearance="primary"
            disabled={busy}
            onClick={() => {
              void controller.appUpdates.install();
            }}
          >
            下载并安装
          </CalendarButton>
        ) : null}
      </div>
      {update.release ? (
        <p className="application-update-version">发现新版本 {update.release.version}</p>
      ) : null}
      {update.release?.notes ? (
        <ReleaseNotesDisclosure
          key={update.release.version}
          source={update.release.notes}
          onOpenLink={openReleaseLink}
        />
      ) : null}
      {update.phase === 'downloading' || update.phase === 'installing' ? (
        <div
          className="application-update-progress tw-mt-2.5 tw-grid tw-gap-1.5 tw-text-[length:12px] tw-text-secondary [&_progress]:tw-h-1.5 [&_progress]:tw-w-full [&_progress]:tw-accent-action"
          aria-live="polite"
        >
          <progress
            aria-label="应用更新进度"
            max={100}
            value={percentage}
          />
          <span>
            {update.phase === 'installing'
              ? '正在安装，即将重新启动…'
              : `正在下载${percentage === undefined ? '…' : ` ${percentage}%`}`}
          </span>
        </div>
      ) : null}
      {update.error ? (
        <p
          className="application-update-error"
          role="alert"
        >
          {update.error}
        </p>
      ) : null}
      {update.phase === 'idle' && !update.release && update.checkedAt && !update.error ? (
        <output className="application-update-status tw-mt-2 tw-block tw-text-[length:12px] tw-leading-[20px] tw-text-[var(--hint-ink)]">
          已是最新版本
        </output>
      ) : null}
      {update.checkedAt ? (
        <p>上次检查：{new Date(update.checkedAt).toLocaleString('zh-CN', { hour12: false })}</p>
      ) : null}
    </section>
  );
}

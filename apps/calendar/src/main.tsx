import { bindPageLifecycle, CalendarApp, CalendarController } from '@i-calendar/ui';
import { invoke } from '@tauri-apps/api/core';
import { Component, StrictMode, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { createPlatform } from './platform.js';
import { Website } from './Website.js';

class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="boot-message tw-p-6 tw-text-[length:13px] tw-text-secondary">
        <h1>日历暂时无法显示</h1>
        <p>本地数据会保留，请重新打开日历。</p>
        <button
          type="button"
          onClick={() => location.reload()}
        >
          重新打开
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

async function start() {
  const { platform, smokeTest } = await createPlatform();
  document.body.dataset.platform = platform.kind;
  const controller = new CalendarController(platform);
  await controller.initialize();
  if (smokeTest && platform.kind === 'macos')
    await controller.setPreferences({
      menuClock: { enabled: true, showIcon: true, format: 'HH:mm:ss' },
    });
  const root = createRoot(document.getElementById('root')!);
  flushSync(() =>
    root.render(
      <StrictMode>
        <AppBoundary>
          {platform.kind === 'web' ? (
            <Website controller={controller} />
          ) : (
            <main className="calendar-stage tw-grid tw-min-h-[100svh] tw-grid-cols-[minmax(0,_1fr)] tw-items-start tw-justify-items-center tw-px-6 tw-py-8 mac:tw-block mac:tw-min-h-[100vh] mac:tw-p-0 ios:tw-pb-[max(12px,env(safe-area-inset-bottom))] ios:tw-pl-[max(10px,env(safe-area-inset-left))] ios:tw-pr-[max(10px,env(safe-area-inset-right))] ios:tw-pt-[max(12px,env(safe-area-inset-top))] compact:tw-items-start compact:tw-p-3">
              <CalendarApp controller={controller} />
            </main>
          )}
        </AppBoundary>
      </StrictMode>,
    ),
  );
  bindPageLifecycle(controller, window);
  if (platform.kind !== 'web') {
    const { emit, listen } = await import('@tauri-apps/api/event');
    if (platform.kind === 'macos') {
      await listen<'settings' | 'about' | 'calculator'>('calendar:navigate', ({ payload }) => {
        flushSync(() => {
          if (payload === 'calculator') controller.showCalculator();
          else controller.showSettings(true, payload === 'about' ? 'about' : 'general');
        });
      });
      await listen('calendar:closed', () => {
        flushSync(() => {
          if (controller.getSnapshot().themeEdit) controller.showThemeCalendar();
          else controller.showSettings(false);
        });
        // 隐藏时 requestAnimationFrame 可能暂停，立即提交日历高度供下次入场使用。
        const content = document.querySelector<HTMLElement>('.calendar-app');
        if (content)
          void platform.setPopupHeight?.(content.scrollHeight).catch((error: unknown) => {
            console.error('收起后恢复日历高度失败', error);
          });
      });
      // 首次显示前同步测量；隐藏的原生窗口可能暂停动画帧。
      const content = document.querySelector<HTMLElement>('.calendar-app');
      if (content) await platform.setPopupHeight?.(content.scrollHeight);
    }
    if (smokeTest) {
      await listen('calendar:smoke-state-request', () => {
        void emit('calendar:smoke-state', {
          panel: document.querySelector('.calendar-app')?.getAttribute('data-panel'),
          settingsTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
          selectedDate: controller.getSnapshot().selected.date,
          preferences: controller.getSnapshot().preferences,
        });
      });
    }
    // 原生冒烟测试经真实 WebView 调用共享核心，再把结果传回 Rust。
    const calculatorVerified = smokeTest
      ? (await import('./calculator-smoke.js')).verifyDateCalculator(controller)
      : undefined;
    const releaseNotesVerified = smokeTest
      ? (await import('./release-notes-smoke.js')).verifyReleaseNotes()
      : undefined;
    const sunlightVerified = smokeTest
      ? await (await import('./sunlight-smoke.js')).verifySunlight(platform)
      : undefined;
    const themesVerified = smokeTest
      ? await (await import('./themes-smoke.js')).verifyThemes(controller).catch(String)
      : undefined;
    const report = {
      sunlightVerified,
      calculatorVerified,
      releaseNotesVerified,
      themesVerified,
      appUpdaterAvailable: !!platform.appUpdater,
      launchAtLoginAvailable: !!platform.launchAtLogin,
      controlGeometry: {
        year: Math.round(
          document.querySelector('[role="combobox"][aria-label="年份"]')?.getBoundingClientRect()
            .height ?? 0,
        ),
        previous: Math.round(
          document.querySelector('button[aria-label="上个月"]')?.getBoundingClientRect().height ??
            0,
        ),
        day: Math.round(
          document.querySelector('button[data-date]')?.getBoundingClientRect().height ?? 0,
        ),
      },
      renderedCells: document.querySelectorAll('[role="gridcell"]').length,
      detailScrollable: (() => {
        const detail = document.querySelector<HTMLElement>('.detail-panel');
        return !detail || detail.scrollHeight > detail.clientHeight + 1;
      })(),
      cells: controller.getSnapshot().month.cells.length,
      lunar: controller.engine.getDay('2026-02-17').lunar.dayName,
      makeup: controller.engine.getDay('2026-02-14').schedule.kind === 'makeup-workday',
      zodiac: controller.engine.getDay('2026-02-17').lunar.zodiac,
      constellation: controller.engine.getDay('2026-11-12').constellation,
      almanac: (() => {
        const value = controller.engine.getAlmanac('2026-12-01');
        return { day: value.ganZhi.day, fu: value.positions.fu, yiCount: value.yi.length };
      })(),
    };
    await invoke('frontend_ready', { report });
    if (smokeTest) document.documentElement.dataset.smokeTest = 'ready';
  }
}

void start().catch((error: unknown) => {
  console.error('i日历启动失败', error);
  const root = document.getElementById('root');
  if (root) {
    root.replaceChildren();
    const message = document.createElement('p');
    message.className = 'boot-message';
    message.textContent = '日历启动失败，请重新打开应用。';
    const retry = document.createElement('button');
    retry.textContent = '重新打开';
    retry.addEventListener('click', () => location.reload());
    root.append(message, retry);
  }
});

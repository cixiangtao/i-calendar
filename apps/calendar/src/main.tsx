import { bindPageLifecycle, CalendarApp, CalendarController } from '@i-calendar/ui';
import { invoke } from '@tauri-apps/api/core';
import { Component, StrictMode, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { version as appVersion } from '../../../package.json';
import { createPlatform } from './platform.js';

class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="boot-message">
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
          <main className="calendar-stage">
            <CalendarApp controller={controller} />
          </main>
          {platform.kind === 'web' ? (
            <section
              className="web-info"
              aria-label="关于i日历"
            >
              <h2>查日子，打开就好。</h2>
              <p>
                i日历提供公农历、节气和中国大陆放假调休。日历计算在本地完成，免费、无广告，无需登录。
              </p>
              <p>
                Mac、iOS 与网页版使用相同的日历核心和界面组件。当前为 {appVersion}
                开发预览，正式官网与应用下载将在 1.0 发布时同步提供。
              </p>
              <p>
                放假与补班根据全国统一安排整理，个人排班以所在单位为准。数据来源可在日历设置中查看。
              </p>
              <p>
                <a href="./third-party-licenses.txt">第三方组件与许可证</a>
              </p>
            </section>
          ) : null}
        </AppBoundary>
      </StrictMode>,
    ),
  );
  bindPageLifecycle(controller, window);
  if (platform.kind !== 'web') {
    const { listen } = await import('@tauri-apps/api/event');
    await listen('calendar:settings', () => controller.showSettings());
    if (platform.kind === 'macos') {
      // 首次显示前同步测量；隐藏的原生窗口可能暂停动画帧。
      const content = document.querySelector<HTMLElement>('.calendar-app');
      if (content) await platform.setPopupHeight?.(content.scrollHeight);
    }
    // 原生冒烟测试经真实 WebView 调用共享核心，再把结果传回 Rust。
    const report = {
      appUpdaterAvailable: !!platform.appUpdater,
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

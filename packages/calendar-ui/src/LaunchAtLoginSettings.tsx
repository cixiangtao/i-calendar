import { useEffect, useSyncExternalStore } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarSwitch } from './CalendarSwitch.js';
import type { LaunchAtLoginController } from './launch-at-login.js';

/** 开关与现有设置共用尺寸、颜色与状态反馈，进入设置及返回窗口时读取系统记录。 */
export function LaunchAtLoginSettings({ controller }: { controller: LaunchAtLoginController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const busy = state.phase === 'checking' || state.phase === 'updating';
  useEffect(() => {
    const refresh = () => {
      void controller.refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [controller]);
  return (
    <section>
      <h2>启动</h2>
      <div className="setting-label">
        <label htmlFor="launch-at-login">开机自启</label>
        <CalendarSwitch
          id="launch-at-login"
          checked={state.enabled === true}
          disabled={state.phase === 'unavailable' || state.enabled === null || busy}
          loading={busy}
          aria-describedby="launch-at-login-hint"
          onChange={(enabled) => {
            void controller.set(enabled);
          }}
        />
      </div>
      <p id="launch-at-login-hint">
        {state.phase === 'unavailable'
          ? '请在打包后的 Mac 应用中设置开机自启。'
          : state.enabled === null && busy
            ? '正在读取系统启动项，确认状态后即可设置。'
            : '登录 Mac 后在菜单栏后台运行，不自动展开日历。'}
      </p>
      {state.error ? (
        <div>
          <p role="alert">{state.error}</p>
          <CalendarButton
            onClick={() => {
              void controller.refresh();
            }}
            disabled={busy}
          >
            重新读取
          </CalendarButton>
        </div>
      ) : null}
    </section>
  );
}

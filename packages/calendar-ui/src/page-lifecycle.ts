import type { CalendarController } from './store.js';

const persisted = (event: Event) => 'persisted' in event && event.persisted === true;

/** 历史缓存保留控制器，恢复时刷新今天；真正退出时释放请求和订阅。 */
export function bindPageLifecycle(
  controller: Pick<CalendarController, 'refreshToday' | 'dispose'>,
  target: EventTarget,
) {
  const hide = (event: Event) => {
    if (!persisted(event)) controller.dispose();
  };
  const show = (event: Event) => {
    if (persisted(event)) controller.refreshToday();
  };
  target.addEventListener('pagehide', hide);
  target.addEventListener('pageshow', show);
  return () => {
    target.removeEventListener('pagehide', hide);
    target.removeEventListener('pageshow', show);
  };
}

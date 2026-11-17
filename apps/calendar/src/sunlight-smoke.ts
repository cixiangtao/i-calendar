import { CalendarController, type CalendarPlatform } from '@i-calendar/ui';
import { invoke } from '@tauri-apps/api/core';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { SunlightSummary } from '../../../packages/calendar-ui/src/Sunlight.js';

/** 真实 WKWebView 验证计算、日期切换与 IPC 隔离，不申请真实权限或保存位置。 */
export async function verifySunlight(platform: CalendarPlatform) {
  const controller = new CalendarController({
    ...platform,
    load: async () => null,
    save: async () => {},
    locate: undefined,
  });
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await controller.initialize();
    await controller.selectSunlightPlace({
      id: '1816670',
      name: '北京市',
      region: '北京',
      latitude: 39.9,
      longitude: 116.4,
    });
    const render = () =>
      flushSync(() =>
        root.render(
          createElement(SunlightSummary, { state: controller.getSnapshot() }),
        ),
      );
    controller.selectDate('2026-06-21');
    render();
    if (
      !container.textContent?.includes('04:45') ||
      !container.textContent.includes('19:46') ||
      container.textContent.includes('北京市') ||
      container.querySelector('button') ||
      container.querySelectorAll('dd').length !== 3
    )
      throw new Error('日照摘要未使用共享计算结果');
    controller.selectDate('2026-12-21');
    render();
    if (!container.textContent?.includes('07:32') || container.textContent.includes('04:45'))
      throw new Error('日照摘要未跟随日期更新');
    let isolated = false;
    try {
      await invoke('locate_sunlight', { requestId: 999 });
    } catch (error) {
      isolated = String(error).includes('隔离冒烟');
    }
    if (!isolated) throw new Error('隔离冒烟没有阻止真实定位请求');
    if (
      (await invoke('describe_sunlight_location', {
        requestId: 999,
        latitude: 39.9,
        longitude: 116.4,
      })) !== null
    )
      throw new Error('隔离冒烟不应联网解析地名');
    await invoke('cancel_sunlight_location', { requestId: 999 });
    return true;
  } finally {
    controller.dispose();
    flushSync(() => root.unmount());
  }
}

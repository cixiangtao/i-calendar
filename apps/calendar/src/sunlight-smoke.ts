import { CalendarController, type CalendarPlatform } from '@i-calendar/ui';
import { invoke } from '@tauri-apps/api/core';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { CalendarButton } from '../../../packages/calendar-ui/src/CalendarButton.js';
import {
  colorThemes,
  contrastRatio,
  resolveColorTheme,
} from '../../../packages/calendar-ui/src/color-theme.js';
import { SunlightSummary, SunlightSettings } from '../../../packages/calendar-ui/src/Sunlight.js';

const hex = (value: string) =>
  '#' +
  value
    .match(/\d+/g)!
    .slice(0, 3)
    .map((number) => Number(number).toString(16).padStart(2, '0'))
    .join('');

/** 真实 WKWebView 验证计算、日期切换与 IPC 隔离，不申请真实权限或保存位置。 */
export async function verifySunlight(platform: CalendarPlatform) {
  const controller = new CalendarController({
    ...platform,
    load: async () => null,
    save: async () => {},
    locate: async () => ({
      latitude: 39.9,
      longitude: 116.4,
      accuracy: 50,
      timestamp: Date.now() - 7 * 60 * 60_000,
      lastKnown: true,
      label: '测试参考点',
    }),
  });
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;--motion-feedback:0ms';
  document.body.append(container);
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
        root.render(createElement(SunlightSummary, { state: controller.getSnapshot() })),
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
    await controller.locateSunlight();
    render();
    if (container.querySelector('dd')) throw new Error('未确认的旧位置不应出现在首页');
    flushSync(() =>
      root.render(createElement(SunlightSettings, { controller, state: controller.getSnapshot() })),
    );
    const accept = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '使用上次位置',
    );
    if (!accept || !container.textContent?.includes('测试参考点'))
      throw new Error('设置缺少历史位置确认入口');
    accept.click();
    render();
    if (container.querySelectorAll('dd').length !== 3) throw new Error('确认位置后缺少日照结果');
    let isolated = false;
    try {
      await invoke('locate_sunlight', { requestId: 999, requestPermission: false });
    } catch (error) {
      isolated = String(
        error && typeof error === 'object' && 'message' in error ? error.message : error,
      ).includes('隔离冒烟');
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
    for (const theme of colorThemes) {
      for (const dark of [false, true]) {
        const { tokens } = resolveColorTheme({ colorTheme: theme.id, accentColor: null }, dark);
        for (const [key, value] of Object.entries(tokens)) container.style.setProperty(key, value);
        for (const busy of [false, true]) {
          flushSync(() =>
            root.render(
              createElement(
                CalendarButton,
                {
                  appearance: 'primary',
                  disabled: true,
                  'aria-busy': busy,
                },
                busy ? '正在请求定位…' : '使用当前位置',
              ),
            ),
          );
          const button = container.querySelector('button')!;
          const style = getComputedStyle(button);
          const background = getComputedStyle(button, '::before').backgroundColor;
          const textFill = style.getPropertyValue('-webkit-text-fill-color');
          const foreground = /^rgba?\(/.test(textFill) ? textFill : style.color;
          if (style.opacity !== '1' || contrastRatio(hex(foreground), hex(background)) < 4.5)
            throw new Error('禁用或等待中的主按钮文字对比度不足');
        }
      }
    }
    let settingsIsolated = false;
    try {
      await invoke('open_sunlight_settings');
    } catch (error) {
      settingsIsolated = String(error).includes('隔离冒烟');
    }
    if (!settingsIsolated) throw new Error('隔离冒烟不应打开真实定位设置');
    return true;
  } finally {
    controller.dispose();
    flushSync(() => root.unmount());
    container.remove();
  }
}

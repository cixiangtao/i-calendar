import type { CalendarController } from '@i-calendar/ui';
import { flushSync } from 'react-dom';

import { encodeThemeArchive } from '../../../packages/calendar-ui/src/theme-archive.js';
import { parseThemeColor } from '../../../packages/calendar-ui/src/theme-color.js';
import { readThemeFile, themeBackground } from '../../../packages/calendar-ui/src/theme-image.js';
import {
  builtInThemes,
  parseThemePackage,
} from '../../../packages/calendar-ui/src/theme-package.js';

const backdropImage = () =>
  document.querySelector<HTMLImageElement>('.calendar-app > .theme-backdrop img');

function verifyPanelAlpha(selector: string, alpha: number) {
  const panel = document.querySelector(selector);
  const background = panel && parseThemeColor(getComputedStyle(panel).backgroundColor);
  if (background?.alpha !== alpha) throw new Error(`主题卡片的透明度不正确：${selector}`);
}

/** 在隔离 WKWebView 内校验默认外观、带图主题文件、挂载和复原。 */
export async function verifyThemes(controller: CalendarController, trace: (stage: string) => void) {
  const previous = controller.getSnapshot().preferences.themes;
  if (backdropImage()) throw new Error('默认清爽白含有背景图片');
  verifyPanelAlpha('.month-panel', 1);
  const mountain = builtInThemes.find((theme) => theme.id === 'mountain')!;
  const transparent = 'rgba(255, 255, 255, 0)';
  const content = {
    ...mountain,
    id: 'smoke-theme',
    palettes: {
      light: { ...mountain.palettes.light, surface: transparent },
      dark: { ...mountain.palettes.dark, surface: transparent },
    },
    background: themeBackground(mountain),
  };
  trace('开始旧主题包解码');
  const legacy = await readThemeFile(new File([JSON.stringify(content)], 'legacy.icaltheme'));
  trace('开始 ZIP 往返');
  const imported = await readThemeFile(new File([await encodeThemeArchive(legacy)], 'smoke.zip'));
  if (!legacy.background?.image || imported.background?.image !== legacy.background.image)
    throw new Error('本地背景主题 ZIP 往返后图片不同');

  trace('开始在线背景地址往返');
  const url = 'https://example.invalid/theme-photo.jpg';
  const onlineTheme = parseThemePackage({
    ...content,
    schemaVersion: 3,
    background: { url, strength: 78, x: 50, y: 50 },
  });
  const online = await readThemeFile(
    new File([await encodeThemeArchive(onlineTheme)], 'online.zip'),
  );
  if (online.background?.url !== url || online.background.image !== undefined)
    throw new Error('在线背景主题导入未保留原链接');
  try {
    trace('开始应用并解码背景');
    const saved = await flushSync(() =>
      controller.setPreferences({ themes: { selectedId: imported.id, custom: [imported] } }),
    );
    const loaded = backdropImage();
    if (!saved || !loaded) throw new Error('带图主题未应用');
    await loaded.decode();
    if (loaded.naturalWidth <= 0) throw new Error('带图主题未正常解码');
    trace('开始检查透明卡片');
    verifyPanelAlpha('.month-panel', 0);
    verifyPanelAlpha('.detail-panel', 0);
    const surface = document.documentElement.style.getPropertyValue('--surface');
    for (const [open, selector] of [
      [() => controller.showSettings(), '.settings-panel'],
      [() => controller.showCalculator(), '[aria-labelledby="calculator-title"]'],
    ] as const) {
      flushSync(open);
      verifyPanelAlpha(selector, 0);
      if (
        backdropImage() !== loaded ||
        document.documentElement.style.getPropertyValue('--surface') !== surface
      )
        throw new Error('应用页面未共用主题画布');
    }
  } finally {
    await flushSync(() => {
      controller.showSettings(false);
      return controller.setPreferences({ themes: previous });
    });
  }
  if (backdropImage()) throw new Error('恢复清爽白后仍有背景图片');
  verifyPanelAlpha('.month-panel', 1);
  trace('开始检查实时草稿');
  const appearance = document.documentElement.dataset.theme;
  const previewAppearance = appearance === 'dark' ? 'light' : 'dark';
  flushSync(() => {
    controller.showSettings(true, 'appearance');
    controller.beginThemeEdit(imported, previewAppearance);
  });
  try {
    const field = document.querySelector<HTMLInputElement>('.settings-panel input[id$="-name"]');
    const preview = document.querySelector<HTMLButtonElement>('.settings-header button');
    if (!field || !preview || document.documentElement.dataset.theme !== previewAppearance)
      throw new Error('编辑主题时未实时预览所选明暗外观');
    verifyPanelAlpha('.settings-panel', 0);
    trace('开始切换到真实月历');
    flushSync(() => preview.click());
    if (field.getClientRects().length || !field.isConnected)
      throw new Error('查看月历时未保留编辑表单');
    verifyPanelAlpha('.month-panel', 0);
    const resume = [...document.querySelectorAll<HTMLButtonElement>('.month-panel button')].find(
      (button) => button.textContent.trim() === '继续编辑',
    );
    if (!resume) throw new Error('预览月历时缺少继续编辑入口');
    trace('开始恢复编辑表单');
    flushSync(() => resume.click());
    if (!field.getClientRects().length) throw new Error('继续编辑后未恢复原表单');
    flushSync(() => controller.cancelThemeEdit());
    if (backdropImage() || document.documentElement.dataset.theme !== appearance)
      throw new Error('取消草稿后未恢复已应用外观');
  } finally {
    flushSync(() => controller.showSettings(false));
  }
  return true;
}

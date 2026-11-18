import type { CalendarController } from '@i-calendar/ui';
import { flushSync } from 'react-dom';

import { readThemeFile, themeBackground } from '../../../packages/calendar-ui/src/theme-image.js';
import { builtInThemes } from '../../../packages/calendar-ui/src/theme-package.js';

const backdropImage = () =>
  document.querySelector<HTMLImageElement>('.calendar-app > .theme-backdrop img');

/** 在隔离 WKWebView 内校验默认外观、带图主题文件、挂载和复原。 */
export async function verifyThemes(controller: CalendarController) {
  const previous = controller.getSnapshot().preferences.themes;
  if (backdropImage()) throw new Error('默认清爽白含有背景图片');
  const mountain = builtInThemes.find((theme) => theme.id === 'mountain')!;
  const content = {
    ...mountain,
    id: 'smoke-theme',
    background: themeBackground(mountain),
  };
  const imported = await readThemeFile(
    new File([JSON.stringify(content)], 'smoke.icaltheme', { type: 'application/json' }),
  );
  try {
    const saved = await flushSync(() =>
      controller.setPreferences({ themes: { selectedId: imported.id, custom: [imported] } }),
    );
    const loaded = backdropImage();
    if (!saved || !loaded) throw new Error('带图主题未应用');
    await loaded.decode();
    if (loaded.naturalWidth <= 0) throw new Error('带图主题未正常解码');
    const surface = document.documentElement.style.getPropertyValue('--surface');
    for (const open of [() => controller.showSettings(), () => controller.showCalculator()]) {
      flushSync(open);
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
  return true;
}

import {
  isAccentColor,
  isColorTheme,
  legacyThemePalette,
  parseCustomColors,
} from './color-theme.js';
import { builtInThemes, parseThemePackage, type CalendarThemePackage } from './theme-package.js';

export interface ThemeLibrary {
  selectedId: string;
  custom: CalendarThemePackage[];
}

const defaultId = builtInThemes[0].id;
const maxCustomThemes = 30;
const maxLibraryImageLength = 1_200_000;

export function isBuiltInTheme(id: string) {
  return builtInThemes.some((theme) => theme.id === id);
}

/** 在已校验的主题库中查找当前主题。 */
export function activeTheme(library: ThemeLibrary): CalendarThemePackage {
  return (
    library.custom.find((theme) => theme.id === library.selectedId) ??
    builtInThemes.find((theme) => theme.id === library.selectedId) ??
    builtInThemes[0]
  );
}

/** 校验整次写入，避免失败导入留下部分主题或失效选择。 */
export function parseThemeLibrary(input: unknown): ThemeLibrary {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new Error('主题列表无效');
  const { selectedId, custom } = input as Record<string, unknown>;
  if (typeof selectedId !== 'string' || !Array.isArray(custom) || custom.length > maxCustomThemes)
    throw new Error('主题列表最多保存 30 个自定义主题');
  const themes = custom.map(parseThemePackage);
  const ids = new Set(themes.map((theme) => theme.id));
  if (
    ids.size !== themes.length ||
    themes.some((theme) => isBuiltInTheme(theme.id)) ||
    (!isBuiltInTheme(selectedId) && !ids.has(selectedId))
  )
    throw new Error('主题标识重复或当前主题不存在');
  const imageLength = themes.reduce(
    (total, theme) => total + (theme.background?.image?.length ?? 0),
    0,
  );
  if (imageLength > maxLibraryImageLength)
    throw new Error('背景图已占满主题存储，请先移除不使用的图片主题');
  return { selectedId, custom: themes };
}

/** 旧偏好在读取时转换。停用的高级配色进入主题库，当前外观单独保留。 */
export function migrateThemeLibrary(legacy: Record<string, unknown>): ThemeLibrary {
  const id = legacy.colorTheme ?? defaultId;
  const accent = legacy.accentColor ?? null;
  if (!isColorTheme(id) || (accent !== null && !isAccentColor(accent)))
    throw new Error('本地显示设置无效');
  const overrides = parseCustomColors(legacy.customColors);
  const custom: CalendarThemePackage[] = [];
  const makeTheme = (
    themeId: string,
    name: string,
    useOverrides: boolean,
  ): CalendarThemePackage => ({
    schemaVersion: 2,
    rulesVersion: 2,
    id: themeId,
    name,
    version: '1.0.0',
    palettes: {
      light: legacyThemePalette(id, accent, 'light', useOverrides ? overrides : undefined),
      dark: legacyThemePalette(id, accent, 'dark', useOverrides ? overrides : undefined),
    },
  });
  let selectedId: string = id;
  if (Object.keys(overrides.light).length || Object.keys(overrides.dark).length) {
    custom.push(makeTheme('my-colors', '我的配色', true));
    if (overrides.enabled) selectedId = 'my-colors';
  }
  if (selectedId === id && accent !== null) {
    selectedId = custom.length ? 'my-accent' : 'my-colors';
    custom.push(makeTheme(selectedId, custom.length ? '我的强调色' : '我的配色', false));
  }
  return { selectedId, custom };
}

/** 用自定义标识保存副本，避免与内置或其他设备里的主题相互覆盖。 */
export function copyTheme(theme: CalendarThemePackage): CalendarThemePackage {
  const random = crypto.getRandomValues(new Uint8Array(16));
  const id = [...random].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return { ...theme, id: 'theme-' + id };
}

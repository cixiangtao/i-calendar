import { normalizeThemeColor } from './theme-color.js';

/** 每种外观的八个主色。 */
export interface ThemePalette {
  canvas: string;
  surface: string;
  ink: string;
  accent: string;
  red: string;
  green: string;
  yellow: string;
  purple: string;
}

export interface ThemeBackground {
  /** 应用已压缩的 JPEG，使用 Base64 原文，以便单文件离线交换。 */
  image: string;
  /** 百分比。零表示隐藏图片。 */
  strength: number;
  x: number;
  y: number;
}

/** 主题格式与派生规则分别版本化，v1 为历史纯色格式。 */
export interface CalendarThemePackage {
  schemaVersion: 1 | 2;
  rulesVersion: 1 | 2;
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  palettes: { light: ThemePalette; dark: ThemePalette };
  background?: ThemeBackground;
}

export const maxThemeImageLength = 300_000;
export const maxThemePackageBytes = 304_000;
export const maxThemeImageSide = 1440;

/** 仅接受完整 RGB 色值，避免主题数据注入任意 CSS。 */
export function isThemeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const paletteKeys = [
  'canvas',
  'surface',
  'ink',
  'accent',
  'red',
  'green',
  'yellow',
  'purple',
] as const;

function validJpeg(value: string) {
  if (
    value.length < 8 ||
    value.length > maxThemeImageLength ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return false;
  const bytes = atob(value);
  const byte = (offset: number) => bytes.charCodeAt(offset);
  const word = (offset: number) => byte(offset) * 256 + byte(offset + 1);
  if (word(0) !== 0xffd8 || word(bytes.length - 2) !== 0xffd9) return false;
  // 在交给图片解码器前检查 JPEG 帧尺寸。浏览器编码器使用基线或渐进式 JPEG。
  for (let offset = 2; offset + 3 < bytes.length;) {
    if (byte(offset) !== 0xff) return false;
    const marker = byte(++offset);
    if (marker === 0xff) continue;
    const length = word(offset + 1);
    if (length < 2 || offset + 1 + length > bytes.length) return false;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8) return false;
      const dimensions = [word(offset + 4), word(offset + 6)];
      return dimensions.every((side) => side > 0 && side <= maxThemeImageSide);
    }
    if (marker === 0xda) return false;
    offset += 1 + length;
  }
  return false;
}

const percent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;

function parseBackground(input: unknown): ThemeBackground {
  if (
    !record(input) ||
    Object.keys(input).some((key) => !['image', 'strength', 'x', 'y'].includes(key)) ||
    typeof input.image !== 'string' ||
    !validJpeg(input.image) ||
    !percent(input.strength) ||
    !percent(input.x) ||
    !percent(input.y)
  )
    throw new Error('背景图或裁切参数无效');
  return { image: input.image, strength: input.strength, x: input.x, y: input.y };
}

/** 校验主题包与图片边界，返回规范化的独立数据副本。 */
export function parseThemePackage(input: unknown): CalendarThemePackage {
  const allowed = [
    'schemaVersion',
    'rulesVersion',
    'id',
    'name',
    'version',
    'author',
    'description',
    'palettes',
    'background',
  ];
  if (
    !record(input) ||
    !(
      (input.schemaVersion === 1 && input.rulesVersion === 1 && input.background === undefined) ||
      (input.schemaVersion === 2 && input.rulesVersion === 2)
    ) ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    typeof input.id !== 'string' ||
    input.id.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 64 ||
    typeof input.version !== 'string' ||
    input.version.length > 32 ||
    !/^\d+\.\d+\.\d+$/.test(input.version) ||
    (input.author !== undefined &&
      (typeof input.author !== 'string' || input.author.length > 64)) ||
    (input.description !== undefined &&
      (typeof input.description !== 'string' || input.description.length > 280)) ||
    !record(input.palettes) ||
    Object.keys(input.palettes).some((key) => !['light', 'dark'].includes(key))
  )
    throw new Error('主题包格式或规则版本不受支持');
  const parsePalette = (value: unknown): ThemePalette => {
    if (
      !record(value) ||
      Object.keys(value).length !== paletteKeys.length ||
      paletteKeys.some((key) => !Object.hasOwn(value, key))
    )
      throw new Error('主题包必须为每种外观提供八个完整主色');
    const color = (key: keyof ThemePalette) => {
      const raw = value[key];
      const normalized =
        input.schemaVersion === 1
          ? isThemeColor(raw)
            ? raw.toLowerCase()
            : null
          : normalizeThemeColor(raw, key === 'canvas' || key === 'surface');
      if (normalized === null) throw new Error('主题包中的主色无效');
      return normalized;
    };
    return {
      canvas: color('canvas'),
      surface: color('surface'),
      ink: color('ink'),
      accent: color('accent'),
      red: color('red'),
      green: color('green'),
      yellow: color('yellow'),
      purple: color('purple'),
    };
  };
  return {
    schemaVersion: input.schemaVersion,
    rulesVersion: input.rulesVersion,
    id: input.id,
    name: input.name.trim(),
    version: input.version,
    ...(input.author !== undefined ? { author: input.author as string } : {}),
    ...(input.description !== undefined ? { description: input.description as string } : {}),
    palettes: {
      light: parsePalette(input.palettes.light),
      dark: parsePalette(input.palettes.dark),
    },
    ...(input.background === undefined ? {} : { background: parseBackground(input.background) }),
  };
}

const light = {
  ink: '#303030',
  red: '#e51c3c',
  green: '#00894f',
  yellow: '#946200',
  purple: '#8b4fc5',
};
const dark = {
  ink: '#f3f3f3',
  red: '#ff8d9b',
  green: '#72d6a1',
  yellow: '#edc56b',
  purple: '#c6a0ed',
};

/** 内置主题与外部主题包使用同一数据契约，派生色不存入主题定义。 */
export const builtInThemes = [
  {
    schemaVersion: 1,
    rulesVersion: 1,
    id: 'clear',
    name: '清爽白',
    version: '1.0.0',
    palettes: {
      light: { ...light, canvas: '#f1f2f6', surface: '#ffffff', accent: '#3269d9' },
      dark: { ...dark, canvas: '#171b23', surface: '#222630', accent: '#3269d9' },
    },
  },
  {
    schemaVersion: 1,
    rulesVersion: 1,
    id: 'paper',
    name: '暖纸色',
    version: '1.0.0',
    palettes: {
      light: { ...light, canvas: '#f2eee6', surface: '#fffdf8', accent: '#90622b' },
      dark: { ...dark, canvas: '#1e1c19', surface: '#292621', accent: '#90622b' },
    },
  },
  {
    schemaVersion: 1,
    rulesVersion: 1,
    id: 'mist',
    name: '雾灰蓝',
    version: '1.0.0',
    palettes: {
      light: { ...light, canvas: '#eaf0f3', surface: '#f9fcfd', accent: '#3c7286' },
      dark: { ...dark, canvas: '#171b23', surface: '#222630', accent: '#3c7286' },
    },
  },
  {
    schemaVersion: 2,
    rulesVersion: 2,
    id: 'mountain',
    name: '山雾',
    version: '1.0.0',
    palettes: {
      light: {
        ...light,
        canvas: '#ddebe7',
        surface: 'rgba(247, 250, 248, 0.9)',
        accent: '#256959',
      },
      dark: { ...dark, canvas: '#162823', surface: 'rgba(28, 46, 40, 0.92)', accent: '#70bfa4' },
    },
  },
  {
    schemaVersion: 2,
    rulesVersion: 2,
    id: 'dusk',
    name: '暮紫',
    version: '1.0.0',
    palettes: {
      light: { ...light, canvas: '#eee7f5', surface: '#fcf9ff', accent: '#7045a5' },
      dark: { ...dark, canvas: '#221c2f', surface: '#2d243c', accent: '#be9be8' },
    },
  },
] as const satisfies readonly CalendarThemePackage[];

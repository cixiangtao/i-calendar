/** 主题只描述八个主色，不携带 CSS、代码、资源或平台行为。 */
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

/** 主题格式与派生规则分别版本化，供后续主题包导入、导出和分发复用。 */
export interface CalendarThemePackage {
  schemaVersion: 1;
  rulesVersion: 1;
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  palettes: { light: ThemePalette; dark: ThemePalette };
}

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

/** 校验外部主题包，拒绝未知字段与规则版本，返回规范化的独立数据副本。 */
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
  ];
  if (
    !record(input) ||
    input.schemaVersion !== 1 ||
    input.rulesVersion !== 1 ||
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
      paletteKeys.some((key) => !Object.hasOwn(value, key) || !isThemeColor(value[key]))
    )
      throw new Error('主题包必须为每种外观提供八个完整主色');
    const color = (key: keyof ThemePalette) => (value[key] as string).toLowerCase();
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
    schemaVersion: 1,
    rulesVersion: 1,
    id: input.id,
    name: input.name.trim(),
    version: input.version,
    ...(input.author !== undefined ? { author: input.author as string } : {}),
    ...(input.description !== undefined ? { description: input.description as string } : {}),
    palettes: {
      light: parsePalette(input.palettes.light),
      dark: parsePalette(input.palettes.dark),
    },
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
] as const satisfies readonly CalendarThemePackage[];

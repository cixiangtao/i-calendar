import { compositeThemeColor } from './theme-color.js';
import {
  builtInThemes,
  isThemeColor,
  type CalendarThemePackage,
  type ThemePalette,
} from './theme-package.js';

/** 配色仅影响共享界面，不改变历法与休班事实。 */
export type ColorThemeId = (typeof builtInThemes)[number]['id'];

/** 预设缩略图从主题包的浅色主色读取，不单独定义第二份配色。 */
export const colorThemes = builtInThemes.map((theme) => ({
  id: theme.id,
  name: theme.name,
  accent: theme.palettes.light.accent,
  canvas: theme.palettes.light.canvas,
  surface: theme.palettes.light.surface,
}));

export const isAccentColor = isThemeColor;

export function isColorTheme(value: unknown): value is ColorThemeId {
  return colorThemes.some((item) => item.id === value);
}

/** 内部渲染色值清单，同时用于校验旧版完整配色与标注对比度问题。 */
export const colorTokenGroups = [
  {
    label: '背景与分隔',
    items: [
      { key: '--canvas', label: '页面背景' },
      { key: '--surface', label: '卡片参考底色与弹层背景' },
      { key: '--line', label: '分隔线与边框' },
      { key: '--control', label: '控件背景' },
      { key: '--control-hover', label: '控件悬停背景' },
      { key: '--control-active', label: '控件按下背景' },
      { key: '--hover', label: '日期悬停背景' },
    ],
  },
  {
    label: '文字层级',
    items: [
      { key: '--ink', label: '主要文字' },
      { key: '--secondary', label: '次要文字' },
      { key: '--muted', label: '弱化文字' },
      { key: '--lunar-ink', label: '农历文字' },
      { key: '--weekday-ink', label: '星期文字' },
      { key: '--hint-ink', label: '说明文字' },
    ],
  },
  {
    label: '操作与选中',
    items: [
      { key: '--blue', label: '操作与选中强调色' },
      { key: '--blue-soft', label: '选中与操作底色' },
      { key: '--selected-bg', label: '选中日期底色' },
      { key: '--selected-ink', label: '选中日期农历文字' },
    ],
  },
  {
    label: '语义颜色',
    items: [
      { key: '--red', label: '周末、休假与警告' },
      { key: '--red-soft', label: '休假与警告底色' },
      { key: '--green', label: '节气、工作日与宜' },
      { key: '--green-soft', label: '工作日与宜底色' },
      { key: '--yellow', label: '补班与提醒' },
      { key: '--yellow-soft', label: '补班与提醒底色' },
      { key: '--purple', label: '节日' },
      { key: '--purple-soft', label: '节日底色' },
    ],
  },
  {
    label: '月外日期',
    items: [
      { key: '--outside-ink', label: '月外普通文字' },
      { key: '--outside-red', label: '月外周末与休假' },
      { key: '--outside-green', label: '月外节气' },
      { key: '--outside-yellow', label: '月外提醒' },
      { key: '--outside-purple', label: '月外节日' },
    ],
  },
  {
    label: '今日日期、主要操作与开关',
    items: [
      { key: '--leaf', label: '今日日期、主要按钮与开启轨道底色' },
      { key: '--leaf-ink', label: '今日日期与主要按钮文字' },
      { key: '--leaf-hover', label: '主要按钮与开启轨道悬停' },
      { key: '--leaf-active', label: '主要按钮与开启轨道按下' },
      { key: '--switch-thumb', label: '开关滑块' },
      { key: '--switch-off', label: '关闭轨道' },
      { key: '--switch-off-hover', label: '关闭轨道悬停' },
      { key: '--switch-off-active', label: '关闭轨道按下' },
    ],
  },
] as const;

export type ColorToken = (typeof colorTokenGroups)[number]['items'][number]['key'];
/** 用户仅编辑主色，内部渲染颜色由 resolveColorTheme 统一派生。 */
export const primaryColorGroups = [
  {
    label: '背景',
    items: [
      { key: '--canvas', label: '页面背景' },
      { key: '--surface', label: '卡片背景' },
    ],
  },
  {
    label: '文字与操作',
    items: [
      { key: '--ink', label: '主要文字' },
      { key: '--blue', label: '操作强调色' },
    ],
  },
  {
    label: '语义主色',
    items: [
      { key: '--red', label: '休假与警告' },
      { key: '--green', label: '节气与工作日' },
      { key: '--yellow', label: '补班与提醒' },
      { key: '--purple', label: '节日' },
    ],
  },
] as const;
export type PrimaryColor = (typeof primaryColorGroups)[number]['items'][number]['key'];
export type ColorOverrides = Partial<Record<PrimaryColor, string>>;
const primaryKeys = new Set<string>(
  primaryColorGroups.flatMap((group) => group.items.map((item) => item.key)),
);

export interface CustomColors {
  enabled: boolean;
  light: ColorOverrides;
  dark: ColorOverrides;
}

const isColorRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 兼容旧版完整配色并只保留主色；返回副本，后续保存不再写入派生色。 */
export function parseCustomColors(input: unknown): CustomColors {
  if (input === undefined) return { enabled: false, light: {}, dark: {} };
  if (
    !isColorRecord(input) ||
    typeof input.enabled !== 'boolean' ||
    Object.keys(input).some((key) => !['enabled', 'light', 'dark'].includes(key))
  )
    throw new Error('高级配色设置无效');
  const allowed = new Set<string>(
    colorTokenGroups.flatMap((group) => group.items.map((item) => item.key)),
  );
  const parse = (value: unknown): ColorOverrides => {
    if (
      !isColorRecord(value) ||
      Object.entries(value).some(([key, color]) => !allowed.has(key) || !isAccentColor(color))
    )
      throw new Error('高级配色设置无效');
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => primaryKeys.has(key))
        .map(([key, color]) => [key, (color as string).toLowerCase()]),
    );
  };
  return { enabled: input.enabled, light: parse(input.light), dark: parse(input.dark) };
}

function channels(color: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

function mix(color: string, target: string, amount: number) {
  const end = channels(target);
  return `#${channels(color)
    .map((value, index) =>
      Math.round(value + (end[index]! - value) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function luminance(color: string) {
  const linear = channels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

/** WCAG 相对亮度对比值；输入为经过校验的 #RRGGBB。 */
export function contrastRatio(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readable(color: string, backgrounds: string[], dark: boolean, minimum = 4.5) {
  let best = color;
  let bestRatio = 0;
  for (const target of dark ? ['#ffffff', '#000000'] : ['#000000', '#ffffff']) {
    for (let step = 0; step <= 100; step++) {
      const candidate = mix(color, target, step / 100);
      const ratio = Math.min(
        ...backgrounds.map((background) => contrastRatio(candidate, background)),
      );
      if (ratio >= minimum) return candidate;
      if (ratio > bestRatio) {
        best = candidate;
        bestRatio = ratio;
      }
    }
  }
  // 两种背景的对比要求可能互斥；保留最可读的折中值并由预览提示。
  return best;
}

/** 从内置主题与兼容偏好中选取主色，再统一生成所有渲染色值。 */
export function resolveColorTheme(
  preferences: {
    colorTheme: ColorThemeId;
    accentColor: string | null;
    customColors?: CustomColors;
  },
  dark: boolean,
  increasedContrast = false,
) {
  const palette = legacyThemePalette(
    preferences.colorTheme,
    preferences.accentColor,
    dark ? 'dark' : 'light',
    preferences.customColors?.enabled ? preferences.customColors : undefined,
  );
  return { accent: palette.accent, tokens: deriveColorTokens(palette, increasedContrast, dark) };
}

/** 合并历史强调色与旧 CSS 角色覆盖，生成对应外观的完整主色。 */
export function legacyThemePalette(
  id: ColorThemeId,
  accent: string | null,
  mode: 'light' | 'dark',
  custom?: CustomColors,
): ThemePalette {
  const theme = builtInThemes.find((item) => item.id === id) ?? builtInThemes[0];
  const palette: ThemePalette = {
    ...theme.palettes[mode],
    accent: accent ?? theme.palettes[mode].accent,
  };
  if (custom) {
    for (const [token, key] of Object.entries(primaryPaletteKeys)) {
      const value = custom[mode][token as PrimaryColor];
      if (value !== undefined) palette[key] = value;
    }
  }
  return palette;
}

/** 根据当前明暗外观生成应用和编辑器共享的渲染颜色。 */
export function resolveThemeTokens(
  theme: CalendarThemePackage,
  dark: boolean,
  increasedContrast = false,
) {
  return deriveColorTokens(theme.palettes[dark ? 'dark' : 'light'], increasedContrast, dark);
}

/** 偏好存储兼容 CSS 角色名；主题包与生成器只使用独立于渲染技术的主色名称。 */
const primaryPaletteKeys = {
  '--canvas': 'canvas',
  '--surface': 'surface',
  '--ink': 'ink',
  '--blue': 'accent',
  '--red': 'red',
  '--green': 'green',
  '--yellow': 'yellow',
  '--purple': 'purple',
} as const satisfies Record<PrimaryColor, keyof ThemePalette>;

/** 卡片保留原始 Alpha，规则 v2 的对比度和交互颜色按合成底色派生。 */
export function deriveColorTokens(palette: ThemePalette, increasedContrast = false, dark = false) {
  const { canvas: canvasColor, surface: surfaceColor, ink, accent, ...semanticBases } = palette;
  const canvas = compositeThemeColor(
    canvasColor,
    builtInThemes[0].palettes[dark ? 'dark' : 'light'].canvas,
  );
  const surface = compositeThemeColor(surfaceColor, canvas);
  const paletteDark = contrastRatio('#ffffff', surface) > contrastRatio('#000000', surface);
  const neutralTarget = paletteDark ? '#ffffff' : '#000000';
  const nearbyCanvas = contrastRatio(surface, canvas) < 1.5;
  const control = paletteDark
    ? mix(surface, neutralTarget, 0.06)
    : nearbyCanvas
      ? mix(surface, canvas, 0.8)
      : mix(surface, neutralTarget, 0.04);
  const hover = paletteDark
    ? mix(surface, neutralTarget, 0.05)
    : nearbyCanvas
      ? mix(surface, canvas, 0.55)
      : mix(surface, neutralTarget, 0.025);
  const soft = mix(surface, accent, paletteDark ? 0.14 : 0.08);
  // 先校正与卡片同色的极端强调色，去掉描边后日期仍有独立的选中底色。
  const selectedBg = mix(
    surface,
    readable(accent, [surface], paletteDark),
    paletteDark ? 0.24 : 0.16,
  );
  const controlHover = mix(control, neutralTarget, paletteDark ? 0.1 : 0.06);
  const controlActive = mix(control, neutralTarget, paletteDark ? 0.16 : 0.1);
  const textSeed = (amount: number) => mix(ink, surface, amount);
  const semanticSurfaces = Object.values(semanticBases).map((base) =>
    mix(surface, base, paletteDark ? 0.16 : 0.07),
  );
  const secondary = readable(
    textSeed(0.26),
    [surface, control, controlHover, controlActive],
    paletteDark,
    increasedContrast ? 7 : 4.5,
  );
  const muted = readable(
    textSeed(0.45),
    [surface, control, hover, ...semanticSurfaces],
    paletteDark,
    increasedContrast ? 7 : 4.5,
  );
  const action = readable(
    accent,
    [surface, soft, selectedBg, control, hover, controlHover, controlActive],
    paletteDark,
    increasedContrast ? 7 : 4.5,
  );
  const minimum = increasedContrast ? 7 : 4.5;
  // 月外日期是上下文提示，按用户要求单独退后；增加对比度模式恢复完整可读性。
  const outsideMinimum = increasedContrast ? 7 : 2.2;
  const outsideInk = readable(
    mix(ink, surface, 0.74),
    [surface, control, ...semanticSurfaces],
    paletteDark,
    outsideMinimum,
  );
  const lunar = readable(
    textSeed(0.4),
    [surface, control, ...semanticSurfaces],
    paletteDark,
    minimum,
  );
  const hint = readable(textSeed(0.4), [surface, canvas, control], paletteDark, minimum);
  const weekday = readable(textSeed(0.15), [surface], paletteDark, minimum);
  const semanticColor = (base: string) => {
    const tint = mix(surface, base, paletteDark ? 0.16 : 0.07);
    const foreground = readable(
      base,
      [surface, ...semanticSurfaces, control, soft, selectedBg],
      paletteDark,
      minimum,
    );
    return {
      foreground,
      tint,
      outside: readable(
        mix(foreground, surface, 0.68),
        [surface, ...semanticSurfaces, control, soft],
        paletteDark,
        outsideMinimum,
      ),
    };
  };
  const red = semanticColor(semanticBases.red);
  const green = semanticColor(semanticBases.green);
  const yellow = semanticColor(semanticBases.yellow);
  const purple = semanticColor(semanticBases.purple);
  const leaf = readable(accent, ['#ffffff'], false);
  const switchOff = readable(controlActive, ['#ffffff'], false);
  const tokens = {
    '--canvas': canvas,
    '--surface': surface,
    '--ink': readable(
      ink,
      [surface, control, controlHover, controlActive, ...semanticSurfaces],
      paletteDark,
      minimum,
    ),
    '--secondary': secondary,
    '--muted': muted,
    '--outside-ink': outsideInk,
    '--lunar-ink': lunar,
    '--weekday-ink': weekday,
    '--hint-ink': hint,
    '--selected-bg': selectedBg,
    '--selected-ink': readable(ink, [soft, selectedBg], paletteDark, minimum),
    '--line': mix(surface, neutralTarget, increasedContrast ? 0.5 : paletteDark ? 0.18 : 0.12),
    '--control': control,
    '--control-hover': controlHover,
    '--control-active': controlActive,
    '--hover': hover,
    '--blue': action,
    '--blue-soft': soft,
    '--leaf': leaf,
    '--leaf-ink': '#ffffff',
    '--switch-thumb': '#ffffff',
    '--leaf-hover': mix(leaf, '#000000', 0.08),
    '--leaf-active': mix(leaf, '#000000', 0.16),
    '--switch-off': switchOff,
    '--switch-off-hover': mix(switchOff, '#000000', 0.08),
    '--switch-off-active': mix(switchOff, '#000000', 0.16),
    '--red': red.foreground,
    '--red-soft': red.tint,
    '--outside-red': red.outside,
    '--green': green.foreground,
    '--green-soft': green.tint,
    '--outside-green': green.outside,
    '--yellow': yellow.foreground,
    '--yellow-soft': yellow.tint,
    '--outside-yellow': yellow.outside,
    '--purple': purple.foreground,
    '--purple-soft': purple.tint,
    '--outside-purple': purple.outside,
  } satisfies Record<ColorToken, string>;
  return { ...tokens, '--panel-background': surfaceColor };
}

/** 检查派生颜色的常用组合；无法同时满足的背景对比要求在预览中提示。 */
export function colorContrastIssues(tokens: Record<ColorToken, string>, increasedContrast = false) {
  const minimum = increasedContrast ? 7 : 4.5;
  const pairs: { foreground: ColorToken; backgrounds: ColorToken[]; minimum: number }[] = [
    ...(['--ink', '--secondary', '--muted', '--lunar-ink'] as const).map((foreground) => ({
      foreground,
      backgrounds: [
        '--surface',
        '--control',
        '--hover',
        '--red-soft',
        '--green-soft',
        ...(foreground === '--ink' || foreground === '--secondary'
          ? ['--control-hover', '--control-active']
          : []),
      ] as ColorToken[],
      minimum,
    })),
    { foreground: '--weekday-ink', backgrounds: ['--surface'], minimum },
    { foreground: '--hint-ink', backgrounds: ['--surface', '--canvas', '--control'], minimum },
    {
      foreground: '--blue',
      backgrounds: [
        '--surface',
        '--blue-soft',
        '--selected-bg',
        '--control',
        '--control-hover',
        '--control-active',
      ],
      minimum,
    },
    { foreground: '--selected-ink', backgrounds: ['--selected-bg'], minimum },
    { foreground: '--leaf-ink', backgrounds: ['--leaf'], minimum: 4.5 },
    {
      foreground: '--switch-thumb',
      backgrounds: [
        '--leaf',
        '--leaf-hover',
        '--leaf-active',
        '--switch-off',
        '--switch-off-hover',
        '--switch-off-active',
      ],
      minimum: 3,
    },
    ...(['red', 'green', 'yellow', 'purple'] as const).map((role) => ({
      foreground: `--${role}` as ColorToken,
      backgrounds: [
        '--surface',
        '--control',
        '--blue-soft',
        '--selected-bg',
        `--${role}-soft`,
      ] as ColorToken[],
      minimum,
    })),
    ...(
      [
        '--outside-ink',
        '--outside-red',
        '--outside-green',
        '--outside-yellow',
        '--outside-purple',
      ] as const
    ).map((foreground) => ({
      foreground,
      backgrounds: ['--surface', '--control', '--red-soft'] as ColorToken[],
      minimum: increasedContrast ? 7 : 2.2,
    })),
  ];
  const labels = new Map<ColorToken, string>(
    colorTokenGroups.flatMap((group) => group.items.map((item) => [item.key, item.label] as const)),
  );
  return pairs.flatMap(({ foreground, backgrounds, minimum: target }) => {
    const ratio = Math.min(
      ...backgrounds.map((background) => contrastRatio(tokens[foreground], tokens[background])),
    );
    return ratio + 0.001 < target
      ? [{ token: foreground, label: labels.get(foreground)!, ratio, minimum: target }]
      : [];
  });
}

/** 配色只作用于共享界面；历法与休班事实不受用户主题设置影响。 */
export type ColorThemeId = 'clear' | 'paper' | 'mist';

export const colorThemes = [
  { id: 'clear', name: '清爽白', accent: '#3269d9', canvas: '#f1f2f6', surface: '#ffffff' },
  { id: 'paper', name: '暖纸色', accent: '#90622b', canvas: '#f2eee6', surface: '#fffdf8' },
  { id: 'mist', name: '雾灰蓝', accent: '#3c7286', canvas: '#eaf0f3', surface: '#f9fcfd' },
] as const;

/** 只接受完整 RGB 十六进制值，防止持久化设置注入任意 CSS。 */
export function isAccentColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export function isColorTheme(value: unknown): value is ColorThemeId {
  return colorThemes.some((item) => item.id === value);
}

/** 可编辑的界面色值清单；标识与 CSS 变量共用，禁止导入未列出的样式属性。 */
export const colorTokenGroups = [
  {
    label: '背景与分隔',
    items: [
      { key: '--canvas', label: '页面背景' },
      { key: '--surface', label: '卡片与弹层背景' },
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
    label: '日期叶片与开关',
    items: [
      { key: '--leaf', label: '日期叶片与开启轨道' },
      { key: '--leaf-ink', label: '日期叶片文字与圆孔' },
      { key: '--leaf-hover', label: '开启轨道悬停' },
      { key: '--leaf-active', label: '开启轨道按下' },
      { key: '--switch-thumb', label: '开关滑块' },
      { key: '--switch-off', label: '关闭轨道' },
      { key: '--switch-off-hover', label: '关闭轨道悬停' },
      { key: '--switch-off-active', label: '关闭轨道按下' },
    ],
  },
] as const;

export type ColorToken = (typeof colorTokenGroups)[number]['items'][number]['key'];
export type ColorOverrides = Partial<Record<ColorToken, string>>;
export interface CustomColors {
  enabled: boolean;
  light: ColorOverrides;
  dark: ColorOverrides;
}

const isColorRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 旧偏好默认不启用高级配色；返回副本，避免外部对象修改已保存的设置。 */
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
      Object.entries(value).map(([key, color]) => [key, (color as string).toLowerCase()]),
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
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, dark ? '#ffffff' : '#000000', step / 100);
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= minimum))
      return candidate;
  }
  return dark ? '#ffffff' : '#000000';
}

/** 为每套主题分别生成浅深色中性色和可读强调色，不改变用户保存的原始选色。 */
export function resolveColorTheme(
  preferences: {
    colorTheme: ColorThemeId;
    accentColor: string | null;
    customColors?: CustomColors;
  },
  dark: boolean,
  increasedContrast = false,
) {
  const preset = colorThemes.find((item) => item.id === preferences.colorTheme) ?? colorThemes[0];
  const accent = preferences.accentColor ?? preset.accent;
  const warm = preset.id === 'paper';
  const surface = dark ? (warm ? '#292621' : '#222630') : preset.surface;
  const canvas = dark ? (warm ? '#1e1c19' : '#171b23') : preset.canvas;
  const control = dark ? (warm ? '#36312b' : '#303642') : mix(surface, canvas, 0.8);
  const hover = dark ? mix(surface, '#ffffff', 0.05) : mix(surface, canvas, 0.55);
  const soft = mix(surface, accent, dark ? 0.14 : 0.08);
  const ink = dark ? '#f3f3f3' : '#303030';
  const controlHover = mix(control, ink, dark ? 0.1 : 0.06);
  const controlActive = mix(control, ink, dark ? 0.16 : 0.1);
  // 节日与休班配色也由主题生成，覆盖三种预设、选中底色和增加对比度模式。
  const semanticBases = {
    red: dark ? '#ff8d9b' : '#e51c3c',
    green: dark ? '#72d6a1' : '#00894f',
    yellow: dark ? '#edc56b' : '#946200',
    purple: dark ? '#c6a0ed' : '#8b4fc5',
  };
  const semanticSurfaces = Object.values(semanticBases).map((base) =>
    mix(surface, base, dark ? 0.16 : 0.07),
  );
  const secondary = readable(
    dark ? '#c4c4c4' : '#626262',
    [surface, control, controlHover, controlActive],
    dark,
    increasedContrast ? 7 : 4.5,
  );
  const muted = readable(
    dark ? '#999999' : '#767676',
    [surface, control, hover, ...semanticSurfaces],
    dark,
    increasedContrast ? 7 : 4.5,
  );
  const action = readable(
    accent,
    [surface, soft, control, hover, controlHover, controlActive],
    dark,
    increasedContrast ? 7 : 4.5,
  );
  const minimum = increasedContrast ? 7 : 4.5;
  // 月外日期是上下文提示，按用户要求单独退后；增加对比度模式恢复完整可读性。
  const outsideMinimum = increasedContrast ? 7 : 2.2;
  const outsideInk = readable(
    mix(ink, surface, 0.74),
    [surface, control, ...semanticSurfaces],
    dark,
    outsideMinimum,
  );
  const lunar = readable(
    dark ? '#b5b5b5' : '#707070',
    [surface, control, ...semanticSurfaces],
    dark,
    minimum,
  );
  const hint = readable(dark ? '#a8a8a8' : '#707070', [surface, canvas, control], dark, minimum);
  const weekday = readable(dark ? '#d0d0d0' : '#4b4b4b', [surface], dark, minimum);
  const semanticColor = (base: string) => {
    const tint = mix(surface, base, dark ? 0.16 : 0.07);
    const foreground = readable(base, [surface, ...semanticSurfaces, control, soft], dark, minimum);
    return {
      foreground,
      tint,
      outside: readable(
        mix(foreground, surface, 0.68),
        [surface, ...semanticSurfaces, control, soft],
        dark,
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
      dark,
      minimum,
    ),
    '--secondary': secondary,
    '--muted': muted,
    '--outside-ink': outsideInk,
    '--lunar-ink': lunar,
    '--weekday-ink': weekday,
    '--hint-ink': hint,
    '--selected-ink': readable(ink, [soft], dark, minimum),
    '--line': increasedContrast ? (dark ? '#737b8e' : '#a1a8b5') : dark ? '#3a3e48' : '#e4e7ed',
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
  const custom = preferences.customColors;
  return {
    accent,
    tokens: { ...tokens, ...(custom?.enabled ? custom[dark ? 'dark' : 'light'] : {}) },
  };
}

/** 检查实际覆盖后的常见前景/背景组合；高级颜色原样应用，提示不阻止保存。 */
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
      backgrounds: ['--surface', '--blue-soft', '--control', '--control-hover', '--control-active'],
      minimum,
    },
    { foreground: '--selected-ink', backgrounds: ['--blue-soft'], minimum },
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
      backgrounds: ['--surface', '--control', '--blue-soft', `--${role}-soft`] as ColorToken[],
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

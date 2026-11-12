/** 配色只作用于共享界面；历法与休班语义不参与用户主题设置。 */
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
  preferences: { colorTheme: ColorThemeId; accentColor: string | null },
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
  const ink = dark ? '#f6f7fb' : '#171b24';
  const controlHover = mix(control, ink, dark ? 0.1 : 0.06);
  const controlActive = mix(control, ink, dark ? 0.16 : 0.1);
  const secondary = readable(
    dark ? '#acb4c3' : '#5b6575',
    [surface, control, controlHover, controlActive],
    dark,
    increasedContrast ? 7 : 4.5,
  );
  const muted = readable(
    dark ? '#929dac' : '#717b8b',
    [surface],
    dark,
    increasedContrast ? 7 : 4.5,
  );
  const action = readable(
    accent,
    [surface, soft, control, hover, controlHover, controlActive],
    dark,
    increasedContrast ? 7 : 4.5,
  );
  const leaf = readable(accent, ['#ffffff'], false);
  const switchOff = readable(controlActive, ['#ffffff'], false);
  return {
    accent,
    tokens: {
      '--canvas': canvas,
      '--surface': surface,
      '--ink': ink,
      '--secondary': secondary,
      '--muted': muted,
      '--line': increasedContrast ? (dark ? '#737b8e' : '#a1a8b5') : dark ? '#3a3e48' : '#e4e7ed',
      '--control': control,
      '--control-hover': controlHover,
      '--control-active': controlActive,
      '--hover': hover,
      '--blue': action,
      '--blue-soft': soft,
      '--leaf': leaf,
      '--leaf-hover': mix(leaf, '#000000', 0.08),
      '--leaf-active': mix(leaf, '#000000', 0.16),
      '--switch-off': switchOff,
      '--switch-off-hover': mix(switchOff, '#000000', 0.08),
      '--switch-off-active': mix(switchOff, '#000000', 0.16),
    },
  };
}

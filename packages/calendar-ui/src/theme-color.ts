export type ThemeColorFormat = 'hex' | 'rgb' | 'hsl';

/** SRGB 八位通道及 0 至 1 的 Alpha；格式切换只改变显示。 */
export interface ThemeColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const numberPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const hexPattern = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const functionPattern = /^(rgb|rgba|hsl|hsla)\(([^()]*)\)$/;

function numberInRange(input: string, limit: number, percent = true) {
  const percentage = percent && input.endsWith('%');
  const digits = percentage ? input.slice(0, -1) : input;
  if (!numberPattern.test(digits)) return NaN;
  const value = Number(digits);
  if (value < 0 || value > (percentage ? 100 : limit)) return NaN;
  return percentage ? (value / 100) * limit : value;
}

function fromHsl(parts: string[], alpha: number): ThemeColor | null {
  const [h = '', s = '', l = ''] = parts;
  const degrees = h.replace(/deg$/, '');
  if (!numberPattern.test(degrees) || !s.endsWith('%') || !l.endsWith('%')) return null;
  const angle = Number(degrees);
  const saturation = numberInRange(s, 1);
  const lightness = numberInRange(l, 1);
  if (![angle, saturation, lightness].every(Number.isFinite)) return null;
  const hue = (((angle % 360) + 360) % 360) / 30;
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number) => {
    const position = (offset + hue) % 12;
    return Math.round(
      255 * (lightness - amplitude * Math.max(-1, Math.min(position - 3, 9 - position, 1))),
    );
  };
  return { red: channel(0), green: channel(8), blue: channel(4), alpha };
}

/** 只解析明确支持的 sRGB 色彩语法，和浏览器的 CSS 求值独立。 */
export function parseThemeColor(value: unknown): ThemeColor | null {
  if (typeof value !== 'string' || value.length > 100) return null;
  const input = value.trim().toLowerCase();
  if (hexPattern.test(input)) {
    const hex = input.slice(1);
    const expanded = hex.length < 5 ? [...hex].map((digit) => digit.repeat(2)).join('') : hex;
    return {
      red: Number.parseInt(expanded.slice(0, 2), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6), 16) / 255 : 1,
    };
  }
  const match = functionPattern.exec(input);
  if (!match) return null;
  const [, name, body = ''] = match;
  const commaSeparated = body.includes(',');
  if (commaSeparated && body.includes('/')) return null;
  const slots = commaSeparated ? body.split(',') : body.split('/');
  if ((commaSeparated && ![3, 4].includes(slots.length)) || (!commaSeparated && slots.length > 2))
    return null;
  const channels = commaSeparated
    ? slots.slice(0, 3).map((part) => part.trim())
    : (slots[0] ?? '').trim().split(/\s+/);
  if (channels.length !== 3) return null;
  const alphaText = slots[commaSeparated ? 3 : 1]?.trim();
  const alpha = alphaText === undefined ? 1 : numberInRange(alphaText, 1);
  if (!Number.isFinite(alpha)) return null;
  if (name === 'hsl' || name === 'hsla') return fromHsl(channels, alpha);
  const [red = NaN, green = NaN, blue = NaN] = channels.map((channel) =>
    Math.round(numberInRange(channel, 255)),
  );
  return [red, green, blue].every(Number.isFinite) ? { red, green, blue, alpha } : null;
}

const decimal = (value: number, digits = 6) => Number(value.toFixed(digits));

/** 用户可切换输入表示，存储始终调用 normalizeThemeColor。 */
export function formatThemeColor(color: ThemeColor, format: ThemeColorFormat): string {
  const { red, green, blue, alpha } = color;
  if (format === 'hex') {
    const channels = alpha === 1 ? [red, green, blue] : [red, green, blue, Math.round(alpha * 255)];
    return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
  }
  const opacity = decimal(alpha);
  const suffix = alpha === 1 ? ')' : ', ' + opacity + ')';
  if (format === 'rgb') {
    return (alpha === 1 ? 'rgb(' : 'rgba(') + [red, green, blue].join(', ') + suffix;
  }
  const [r = 0, g = 0, b = 0] = [red, green, blue].map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  let angle = 0;
  let saturation = 0;
  if (chroma) {
    angle = max === r ? (g - b) / chroma : max === g ? 2 + (b - r) / chroma : 4 + (r - g) / chroma;
    saturation = chroma / (1 - Math.abs(2 * lightness - 1));
  }
  const hue = decimal((angle * 60 + 360) % 360, 3);
  const parts = [hue, decimal(saturation * 100, 3) + '%', decimal(lightness * 100, 3) + '%'];
  return (alpha === 1 ? 'hsl(' : 'hsla(') + parts.join(', ') + suffix;
}

/** 只允许背景色有 Alpha。透明度保留六位小数，实色输出六位 HEX。 */
export function normalizeThemeColor(value: unknown, allowAlpha: boolean): string | null {
  const color = parseThemeColor(value);
  if (!color || (!allowAlpha && color.alpha !== 1)) return null;
  color.alpha = decimal(color.alpha);
  return formatThemeColor(color, color.alpha === 1 ? 'hex' : 'rgb');
}

/** 先合成确定的实色底，再用实际显示背景计算前景对比度。 */
export function compositeThemeColor(color: string, background: string): string {
  const foreground = parseThemeColor(color);
  if (!foreground || foreground.alpha === 1) return color;
  const base = parseThemeColor(background)!;
  const { alpha } = foreground;
  const blend = (top: number, bottom: number) => Math.round(top * alpha + bottom * (1 - alpha));
  return formatThemeColor(
    {
      red: blend(foreground.red, base.red),
      green: blend(foreground.green, base.green),
      blue: blend(foreground.blue, base.blue),
      alpha: 1,
    },
    'hex',
  );
}

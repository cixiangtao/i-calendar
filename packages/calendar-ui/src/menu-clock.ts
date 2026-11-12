/** 菜单栏时钟设置由原生层执行，Web 只复用格式校验和预览。 */
export interface MenuClockPreferences {
  enabled: boolean;
  /** 为 false 时只显示时间；至少保留图标或有效时间文字。 */
  showIcon: boolean;
  format: string;
}

export const defaultMenuClock: Readonly<MenuClockPreferences> = Object.freeze({
  enabled: true,
  showIcon: true,
  format: 'HH:mm',
});
export const menuClockPresets = [
  { label: '时分', value: 'HH:mm' },
  { label: '时分秒', value: 'HH:mm:ss' },
  { label: '日期、星期和时间', value: 'MM月DD日 ddd HH:mm' },
  { label: '12 小时制', value: 'A hh:mm' },
] as const;

const tokens = [
  'YYYY',
  'dddd',
  'ddd',
  'YY',
  'MM',
  'DD',
  'HH',
  'hh',
  'mm',
  'ss',
  'M',
  'D',
  'H',
  'h',
  'm',
  's',
  'A',
] as const;
type ClockToken = (typeof tokens)[number];
type ClockSegment = { token: ClockToken } | { literal: string };

/** 最长匹配格式符；方括号内容按原文显示，不接收换行或控制字符。 */
export function parseClockFormat(format: string): ClockSegment[] {
  if (
    !format.trim() ||
    format.length > 48 ||
    Array.from(format).some((character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029;
    })
  )
    throw new RangeError('格式须为 1—48 个字符，且不能包含换行或控制字符');
  const parts: ClockSegment[] = [];
  for (let offset = 0; offset < format.length;) {
    if (format[offset] === '[') {
      const end = format.indexOf(']', offset + 1);
      if (end < 0) throw new RangeError('方括号未闭合');
      parts.push({ literal: format.slice(offset + 1, end) });
      offset = end + 1;
      continue;
    }
    const token = tokens.find((item) => format.startsWith(item, offset));
    if (token) {
      parts.push({ token });
      offset += token.length;
    } else {
      const character = format[offset]!;
      if (/[A-Za-z\]%]/.test(character))
        throw new RangeError('存在不支持的格式符；普通英文请放在方括号中');
      parts.push({ literal: character });
      offset++;
    }
  }
  return parts;
}

/** 兼容旧偏好，始终返回新的设置对象。 */
export function parseMenuClock(input: unknown): MenuClockPreferences {
  if (input === undefined) return { ...defaultMenuClock };
  if (
    typeof input !== 'object' ||
    input === null ||
    !('enabled' in input) ||
    !('format' in input) ||
    typeof input.enabled !== 'boolean' ||
    typeof input.format !== 'string'
  )
    throw new Error('菜单栏时间设置无效');
  const showIcon = 'showIcon' in input ? input.showIcon : true;
  if (typeof showIcon !== 'boolean') throw new Error('菜单栏图标设置无效');
  const parts = parseClockFormat(input.format);
  if (
    !showIcon &&
    (!input.enabled || !parts.some((part) => 'token' in part || part.literal.trim()))
  )
    throw new Error('请至少显示图标或有效的时间文字');
  return { enabled: input.enabled, showIcon, format: input.format };
}

/** 预览按系统时区显示；测试可显式提供时区，与日期查询的北京时间口径独立。 */
export function formatMenuClock(format: string, instant: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === name)!.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][
    new Date(`${year}-${month}-${day}T00:00:00Z`).getUTCDay()
  ]!;
  const twelve = Number(hour) % 12 || 12;
  const values: Record<ClockToken, string> = {
    YYYY: year,
    YY: year.slice(-2),
    MM: month,
    M: String(Number(month)),
    DD: day,
    D: String(Number(day)),
    ddd: `周${weekday}`,
    dddd: `星期${weekday}`,
    HH: hour,
    H: String(Number(hour)),
    hh: String(twelve).padStart(2, '0'),
    h: String(twelve),
    mm: minute,
    m: String(Number(minute)),
    ss: second,
    s: String(Number(second)),
    A: Number(hour) < 12 ? '上午' : '下午',
  };
  return parseClockFormat(format)
    .map((part) => ('token' in part ? values[part.token] : part.literal))
    .join('');
}

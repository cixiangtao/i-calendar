import mountain from './assets/theme-mountain.jpg?inline';
import {
  maxThemeImageLength,
  maxThemeImageSide,
  maxThemePackageBytes,
  parseThemePackage,
  type CalendarThemePackage,
  type ThemeBackground,
} from './theme-package.js';

const jpegPrefix = 'data:image/jpeg;base64,';
const mountainBackground: ThemeBackground = {
  image: mountain.slice(jpegPrefix.length),
  strength: 78,
  x: 50,
  y: 61,
};

export function themeBackground(theme: CalendarThemePackage) {
  return theme.background ?? (theme.id === 'mountain' ? mountainBackground : undefined);
}

export const themeImageUrl = (background: ThemeBackground) =>
  background.url ?? jpegPrefix + background.image;

async function decodeImage(url: string) {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error('图片无法打开，请重新选取图片');
  }
  return image;
}

/** 在设备上重编码图像，限制空间占用并去掉原文件元数据。 */
export async function prepareThemeImage(file: File) {
  if (!file.size || file.size > 12_000_000) throw new Error('请选择 12 MB 以内的图片');
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature: number[], start = 0) =>
    signature.every((byte, index) => header[index + start] === byte);
  const mime = matches([0xff, 0xd8, 0xff])
    ? 'image/jpeg'
    : matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ? 'image/png'
      : matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8)
        ? 'image/webp'
        : null;
  if (!mime) throw new Error('请选择 JPG、PNG 或 WebP 图片');
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string), { once: true });
    reader.addEventListener('error', () => reject(new Error('图片文件无法读取')), { once: true });
    reader.readAsDataURL(file.slice(0, file.size, mime));
  });
  const image = await decodeImage(url);
  if (image.naturalWidth * image.naturalHeight > 40_000_000)
    throw new Error('图片尺寸过大，请先缩小图片');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('当前设备无法处理图片');
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  for (const side of [maxThemeImageSide, 1080, 810, 600]) {
    const scale = Math.min(1, side / longest);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', 0.78);
    if (result.startsWith(jpegPrefix) && result.length <= maxThemeImageLength + jpegPrefix.length)
      return result.slice(jpegPrefix.length);
  }
  throw new Error('图片压缩后仍然过大');
}

/** 读取并校验主题包及其背景，完成后才交给导入预览。 */
export async function readThemeFile(file: File) {
  if (!file.size || file.size > maxThemePackageBytes) throw new Error('主题文件为空或超过大小限制');
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error('主题文件无法读取，请选择有效的 .icaltheme 或旧版 JSON');
  }
  const theme = parseThemePackage(value);
  if (theme.background?.image) await decodeImage(themeImageUrl(theme.background));
  return theme;
}

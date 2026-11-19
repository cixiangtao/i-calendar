import type { FileEntry } from '@zip.js/zip.js/lib/zip-core-native.js';

import {
  maxThemeImageLength,
  maxThemePackageBytes,
  parseThemePackage,
  type CalendarThemePackage,
} from './theme-package.js';

const archiveVersion = 1;
const manifestPath = 'theme.json';
const imagePath = 'assets/background.jpg';
const maxManifestBytes = 16_000;
const maxImageBytes = (maxThemeImageLength / 4) * 3;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    throw new Error('主题配置无法读取，请检查 JSON 格式');
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 16384;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/** 导出单文件主题包，本地图作为二进制资源，在线图沿用链接。 */
export async function encodeThemeArchive(
  input: CalendarThemePackage,
): Promise<Uint8Array<ArrayBuffer>> {
  const theme = parseThemePackage(input);
  const { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } =
    await import('@zip.js/zip.js/lib/zip-core-native.js');
  const writer = new ZipWriter(new Uint8ArrayWriter(), { level: 0, useWebWorkers: false });
  const image = theme.background?.image;
  const background =
    image && theme.background
      ? {
          file: imagePath,
          strength: theme.background.strength,
          x: theme.background.x,
          y: theme.background.y,
        }
      : theme.background;
  const manifest = encoder.encode(
    JSON.stringify({ archiveVersion, theme: { ...theme, background } }, null, 2) + '\n',
  );
  await writer.add(manifestPath, new Uint8ArrayReader(manifest));
  if (image) {
    const bytes = Uint8Array.from(atob(image), (character) => character.charCodeAt(0));
    await writer.add(imagePath, new Uint8ArrayReader(bytes));
  }
  const archive = await writer.close();
  if (archive.byteLength > maxThemePackageBytes) throw new Error('主题文件超过大小限制');
  return archive;
}

async function readEntry(entry: FileEntry, limit: number) {
  const size = entry.uncompressedSize;
  if (!Number.isSafeInteger(size) || size < 1 || size > limit)
    throw new Error('主题文件超过大小限制');
  const bytes = new Uint8Array(size);
  let offset = 0;
  // 同时限制实际解压字节数，避免输入只在 ZIP 目录中申报较小的长度。
  await entry.getData(
    new WritableStream<Uint8Array>({
      write(chunk) {
        if (chunk.byteLength > bytes.length - offset) throw new Error('主题文件超过大小限制');
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      },
    }),
  );
  if (offset !== size) throw new Error('主题 ZIP 的文件长度不一致');
  return bytes;
}

async function readArchive(bytes: Uint8Array<ArrayBuffer>) {
  const { ZipReader, Uint8ArrayReader, configure } =
    await import('@zip.js/zip.js/lib/zip-core-native.js');
  // 限制解压分块，使用库内解码器以兼容最低版本的 WKWebView。
  configure({ chunkSize: 4096 });
  const reader = new ZipReader(new Uint8ArrayReader(bytes), {
    strictness: 'strict',
    checkCrc32: true,
    checkOverlappingEntry: true,
    useWebWorkers: false,
    useCompressionStream: false,
  });
  try {
    const entries = new Map<string, Uint8Array<ArrayBuffer>>();
    let assetDirectory = false;
    for await (const entry of reader.getEntriesGenerator()) {
      const name = entry.filename;
      if (entry.directory && name === 'assets/' && !assetDirectory) {
        assetDirectory = true;
        continue;
      }
      const limit =
        name === manifestPath ? maxManifestBytes : name === imagePath ? maxImageBytes : 0;
      if (!limit || entry.directory || entry.encrypted || entries.has(name))
        throw new Error('主题 ZIP 含有未知、重复或加密的文件');
      if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
        throw new Error('主题 ZIP 使用了不支持的压缩方式');
      entries.set(name, await readEntry(entry, limit));
    }
    return entries;
  } finally {
    await reader.close();
  }
}

/** 从内容识别 ZIP 或旧版 JSON，并转换为现有主题库使用的结构。 */
export async function decodeThemeFile(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<CalendarThemePackage> {
  if (!bytes.byteLength || bytes.byteLength > maxThemePackageBytes)
    throw new Error('主题文件为空或超过大小限制');
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return parseThemePackage(parseJson(bytes));

  const entries = await readArchive(bytes).catch(() => {
    throw new Error('无法读取主题 ZIP，请检查文件结构、大小和完整性');
  });
  const data = entries.get(manifestPath);
  if (!data) throw new Error('主题 ZIP 缺少 theme.json');
  const manifest = parseJson(data);
  if (
    !isRecord(manifest) ||
    manifest.archiveVersion !== archiveVersion ||
    Object.keys(manifest).length !== 2 ||
    !isRecord(manifest.theme)
  )
    throw new Error('主题 ZIP 格式版本不受支持');
  const { theme } = manifest;
  const background = theme.background;
  const image = entries.get(imagePath);
  if (isRecord(background) && Object.hasOwn(background, 'file')) {
    if (
      background.file !== imagePath ||
      !image ||
      Object.hasOwn(background, 'image') ||
      Object.hasOwn(background, 'url')
    )
      throw new Error('主题背景图文件缺失或引用无效');
    const { file: _file, ...layout } = background;
    return parseThemePackage({ ...theme, background: { ...layout, image: toBase64(image) } });
  }
  if (image || (isRecord(background) && Object.hasOwn(background, 'image')))
    throw new Error('主题 ZIP 的背景图应通过文件引用');
  return parseThemePackage(theme);
}

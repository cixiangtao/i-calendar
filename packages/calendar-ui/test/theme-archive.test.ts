import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js/lib/zip-core-native.js';

import { decodeThemeFile, encodeThemeArchive } from '../src/theme-archive.js';
import { builtInThemes, maxThemePackageBytes, parseThemePackage } from '../src/theme-package.js';

const plain = parseThemePackage(builtInThemes[0]);
const backgroundPath = 'assets/background.jpg';
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const manifest = (theme: unknown) => json({ archiveVersion: 1, theme });

async function localTheme() {
  const image = await readFile(new URL('../src/assets/theme-mountain.jpg', import.meta.url));
  const layout = { strength: 65, x: 37, y: 70 };
  const theme = parseThemePackage({
    ...plain,
    schemaVersion: 2,
    rulesVersion: 2,
    background: { image: image.toString('base64'), ...layout },
  });
  return { image, layout, theme };
}

async function makeZip(entries: Array<[string, Uint8Array<ArrayBuffer>]>, level = 0) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    level,
    useCompressionStream: false,
    useWebWorkers: false,
  });
  for (const [name, bytes] of entries) await writer.add(name, new Uint8ArrayReader(bytes));
  return writer.close();
}

test('导出的 ZIP 将本地 JPEG 独立存放，主题与裁切可完整往返', async () => {
  const { image, layout, theme } = await localTheme();
  const archive = await encodeThemeArchive(theme);
  const reader = new ZipReader(new Uint8ArrayReader(archive));
  try {
    const entries = await reader.getEntries();
    assert.deepEqual(
      entries.map((entry) => entry.filename),
      ['theme.json', backgroundPath],
    );
    const config = await entries[0].getData?.(new Uint8ArrayWriter());
    assert.deepEqual(JSON.parse(new TextDecoder().decode(config)), {
      archiveVersion: 1,
      theme: { ...theme, background: { file: backgroundPath, ...layout } },
    });
    const bytes = await entries[1].getData?.(new Uint8ArrayWriter());
    assert.deepEqual(bytes, new Uint8Array(image));
  } finally {
    await reader.close();
  }
  assert.deepEqual(await decodeThemeFile(archive), theme);
  assert.deepEqual(await decodeThemeFile(json(theme)), theme);
});

test('纯色与在线主题仅含清单，同时保留旧版 JSON 导入', async () => {
  const online = parseThemePackage({
    ...plain,
    schemaVersion: 3,
    rulesVersion: 2,
    background: {
      url: 'https://images.example.org/photo?token=a%2Fb',
      strength: 65,
      x: 37,
      y: 70,
    },
  });
  for (const theme of [plain, online]) {
    const archive = await encodeThemeArchive(theme);
    const reader = new ZipReader(new Uint8ArrayReader(archive));
    try {
      const entries = await reader.getEntries();
      assert.deepEqual(
        entries.map((entry) => entry.filename),
        ['theme.json'],
      );
    } finally {
      await reader.close();
    }
    assert.deepEqual(await decodeThemeFile(archive), theme);
    assert.deepEqual(await decodeThemeFile(json(theme)), theme);
  }
});

test('可导入采用 Deflate 的 ZIP，允许归档工具添加背景目录项', async () => {
  const { image, layout, theme } = await localTheme();
  const archive = await makeZip(
    [
      ['theme.json', manifest({ ...theme, background: { file: backgroundPath, ...layout } })],
      ['assets/', new Uint8Array()],
      [backgroundPath, new Uint8Array(image)],
    ],
    6,
  );
  assert.deepEqual(await decodeThemeFile(archive), theme);
});

test('拒绝损坏、未知路径、缺图和超大小限制的 ZIP', async () => {
  const { layout, theme } = await localTheme();
  const data = manifest(plain);
  const damaged = await makeZip([['theme.json', data]]);
  const configOffset = Buffer.from(damaged).indexOf(data);
  assert.ok(configOffset > 0);
  damaged[configOffset + 2] ^= 1;

  const unexpected = await makeZip([
    ['theme.json', data],
    ['../extra', data],
  ]);
  const missing = await makeZip([
    ['theme.json', manifest({ ...theme, background: { file: backgroundPath, ...layout } })],
  ]);
  const oversized = await makeZip(
    [
      ['theme.json', manifest({ ...theme, background: { file: backgroundPath, ...layout } })],
      [backgroundPath, new Uint8Array(225_001)],
    ],
    6,
  );
  assert.ok(oversized.byteLength < maxThemePackageBytes);
  for (const archive of [damaged, unexpected, oversized])
    await assert.rejects(decodeThemeFile(archive), /无法读取主题 ZIP/);
  await assert.rejects(decodeThemeFile(missing), /背景图文件缺失/);
  await assert.rejects(decodeThemeFile(new Uint8Array(maxThemePackageBytes + 1)), /大小限制/);
});

test('ZIP 目录有效时仍检查主题清单、版本与内容', async () => {
  const ordinaryArchive = await makeZip([['assets/', new Uint8Array()]]);
  const unsupported = await makeZip([['theme.json', json({ archiveVersion: 2, theme: plain })]]);
  const invalid = await makeZip([['theme.json', manifest({ ...plain, palettes: {} })]]);
  await assert.rejects(decodeThemeFile(ordinaryArchive), /缺少 theme\.json/);
  await assert.rejects(decodeThemeFile(unsupported), /格式版本不受支持/);
  await assert.rejects(decodeThemeFile(invalid), /八个完整主色/);
});

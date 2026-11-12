import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { crc32 } from 'node:zlib';

if (process.platform !== 'darwin') throw new Error('图标资源需要在 macOS 上生成。');
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'packages/calendar-ui/src/assets/logo.svg';
const icons = path.join(root, 'apps/calendar/src-tauri/icons');
const work = path.join(root, 'work/brand');
const iconset = path.join(work, 'AppIcon.iconset');
await mkdir(iconset, { recursive: true });

// PNG 随附矢量来源，修改主 SVG 后可重新生成，不把位图作为独立设计维护。
async function render(svg, destination, size, origin) {
  await run('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', destination, svg]);
  const png = await readFile(destination);
  const data = Buffer.from(`Source\0${origin}`, 'utf8');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write('tEXt', 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  await writeFile(destination, Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]));
}

const logo = await readFile(path.join(root, source), 'utf8');
await copyFile(path.join(root, source), path.join(root, 'apps/calendar/public/favicon.svg'));

// Mac 图标保留系统图标间距；通用 1024 源图铺满底色，供 iOS 系统裁切外形。
const squareSource = path.join(work, 'square-icon.svg');
await writeFile(squareSource, logo.replace('rx="14"', 'rx="0"'));
await render(squareSource, path.join(icons, 'icon.png'), 1024, `${source} (square background)`);
const macSource = path.join(work, 'mac-icon.svg');
const shapes = logo.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
await writeFile(
  macSource,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(80 80) scale(13.5)">${shapes}</g></svg>\n`,
);
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const file = path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`);
    await render(macSource, file, size * scale, `${source} (macOS inset 80/1024)`);
  }
}
for (const [file, size] of [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
]) {
  await render(macSource, path.join(icons, file), size, `${source} (macOS inset 80/1024)`);
}
await run('iconutil', ['-c', 'icns', iconset, '-o', path.join(icons, 'icon.icns')]);
await render(
  path.join(icons, 'tray.svg'),
  path.join(icons, 'tray.png'),
  44,
  'apps/calendar/src-tauri/icons/tray.svg',
);
console.log('已从共享 SVG 生成网页图标、Mac 应用图标与菜单栏模板图标。');

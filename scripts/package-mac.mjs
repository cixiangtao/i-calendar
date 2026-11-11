import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = process.cwd();
const platform = path.join(root, 'platforms/apple');
console.log('正在构建拾日历原生 macOS 应用…');
const built = await run('swift', ['build', '--package-path', platform, '-c', 'release', '--product', 'ShiriCalendar'], { maxBuffer: 4_000_000 });
if (built.stderr) console.log(built.stderr);
const { stdout } = await run('swift', ['build', '--package-path', platform, '-c', 'release', '--show-bin-path']);
const executable = path.join(stdout.trim(), 'ShiriCalendar');
const app = path.join(root, 'outputs/mac/拾日历.app');
await mkdir(path.join(app, 'Contents/MacOS'), { recursive: true });
await mkdir(path.join(app, 'Contents/Resources'), { recursive: true });
await copyFile(executable, path.join(app, 'Contents/MacOS/ShiriCalendar'));
await copyFile('dist/apple/calendar-core.js', path.join(app, 'Contents/Resources/calendar-core.js'));
await copyFile('THIRD_PARTY_NOTICES.md', path.join(app, 'Contents/Resources/THIRD_PARTY_NOTICES.md'));
await writeFile(path.join(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>拾日历</string>
<key>CFBundleDisplayName</key><string>拾日历</string>
<key>CFBundleIdentifier</key><string>local.shiri.calendar</string>
<key>CFBundleExecutable</key><string>ShiriCalendar</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
<key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
</dict></plist>
`);
await mkdir('work/AppIcon.iconset', { recursive: true });
await run('swift', ['scripts/make-icon.swift', 'work/icon-1024.png']);
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixels = String(size * scale);
    await run('sips', ['-z', pixels, pixels, 'work/icon-1024.png', '--out', `work/AppIcon.iconset/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`]);
  }
}
await run('iconutil', ['-c', 'icns', 'work/AppIcon.iconset', '-o', path.join(app, 'Contents/Resources/AppIcon.icns')]);
await run('codesign', ['--force', '--deep', '--sign', '-', app]);
await run('codesign', ['--verify', '--deep', '--strict', app]);
await run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, path.join(root, 'outputs/拾日历-0.1.0-mac-arm64.zip')]);
console.log(`构建完成：${app}`);

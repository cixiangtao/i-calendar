import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, cp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('Mac 应用需要在 macOS 上构建。');
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, 'scripts/tauri.mjs'), 'build', '--ci', '--bundles', 'app'], { cwd: root, stdio: 'inherit' });
  child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Tauri 构建失败（${code}）`)));
});
const source = path.join(root, 'apps/calendar/src-tauri/target/release/bundle/macos/拾日历.app');
const app = path.join(root, 'outputs/mac/拾日历.app');
await mkdir(path.dirname(app), { recursive: true });
await rm(app, { recursive: true, force: true });
await cp(source, app, { recursive: true });
await run('codesign', ['--verify', '--deep', '--strict', app]);
const archive = path.join(root, `outputs/拾日历-${version}-mac-${process.arch}.zip`);
await rm(archive, { force: true });
await run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive]);
console.log(`Mac 应用：${app}\n本地压缩包：${archive}\n当前为本地临时签名，正式分发仍需开发者签名与公证。`);

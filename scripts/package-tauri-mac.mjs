import { execFile, spawn } from 'node:child_process';
import { mkdir, cp, rm, readFile, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { signedPlatform, updateConfiguration, verifyUpdate } from './update-release.mjs';

if (process.platform !== 'darwin') throw new Error('Mac 应用需要在 macOS 上构建。');
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const withUpdater = process.argv.includes('--updater');
if (process.argv.slice(2).some((arg) => arg !== '--updater'))
  throw new Error('未知的 Mac 打包参数。');
const configuration = updateConfiguration();
if (configuration && !withUpdater)
  throw new Error('已配置更新源，请使用 pnpm run build:mac:update 生成并验证签名更新包。');
if (withUpdater && (!configuration || !process.env.TAURI_SIGNING_PRIVATE_KEY))
  throw new Error('更新打包需要应用更新地址、公钥与 TAURI_SIGNING_PRIVATE_KEY。');
await mkdir(path.join(root, 'work'), { recursive: true });
const temporary = await mkdtemp(path.join(root, 'work/update-build-'));
const args = [path.join(root, 'scripts/tauri.mjs'), 'build', '--ci', '--bundles', 'app'];
try {
  if (withUpdater) {
    const config = path.join(temporary, 'updater.conf.json');
    await writeFile(
      config,
      JSON.stringify({
        bundle: { createUpdaterArtifacts: true },
        plugins: {
          updater: { pubkey: configuration.publicKey, requireSignedVersion: true },
        },
      }),
    );
    args.push('--config', config);
  }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(configuration
          ? {
              I_CALENDAR_UPDATE_ENDPOINT: configuration.endpoint,
              I_CALENDAR_UPDATE_PUBKEY: configuration.publicKey,
            }
          : {}),
      },
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Tauri 构建失败（${code}）`)),
    );
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
const source = path.join(root, 'apps/calendar/src-tauri/target/release/bundle/macos/i日历.app');
const app = path.join(root, 'outputs/mac/i日历.app');
await mkdir(path.dirname(app), { recursive: true });
await rm(app, { recursive: true, force: true });
await cp(source, app, { recursive: true });
await run('codesign', ['--verify', '--deep', '--strict', app]);
const archive = path.join(root, `outputs/i日历-${version}-mac-${process.arch}.zip`);
await rm(archive, { force: true });
await run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive]);
if (withUpdater) {
  const updaterArchive = `${source}.tar.gz`;
  const target = process.arch === 'arm64' ? 'darwin-aarch64' : 'darwin-x86_64';
  const platform = await signedPlatform(
    updaterArchive,
    'https://example.invalid/update.app.tar.gz',
  );
  await verifyUpdate(
    { version, platforms: { [target]: platform } },
    updaterArchive,
    target,
    configuration.publicKey,
  );
  const output = path.join(root, `outputs/i日历-${version}-mac-${process.arch}.app.tar.gz`);
  await cp(updaterArchive, output);
  await cp(`${updaterArchive}.sig`, `${output}.sig`);
  console.log(`已验签的更新包：${output}\n更新签名：${output}.sig`);
}
console.log(
  `Mac 应用：${app}\n本地压缩包：${archive}\n当前为本地临时签名，正式分发仍需开发者签名与公证。`,
);

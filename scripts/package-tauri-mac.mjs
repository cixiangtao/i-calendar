import { execFile, execFileSync, spawn } from 'node:child_process';
import { mkdir, cp, rm, readFile, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { signedPlatform, updateConfiguration, verifyUpdate } from './update-release.mjs';

if (process.platform !== 'darwin') throw new Error('Mac 应用需要在 macOS 上构建。');
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const native = path.join(root, 'apps/calendar/src-tauri');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const [mode, ...extraArgs] = process.argv.slice(2);
if (extraArgs.length || (mode !== undefined && mode !== '--dev' && mode !== '--updater'))
  throw new Error('未知的 Mac 打包参数。');
const development = mode === '--dev';
const withUpdater = mode === '--updater';
const devConfig = path.join(native, 'tauri.macos.dev.conf.json');
const productName = development
  ? JSON.parse(await readFile(devConfig, 'utf8')).productName
  : 'i日历';
const configuration = development ? null : updateConfiguration();
if (configuration && !withUpdater)
  throw new Error('已配置更新源，请使用 pnpm run build:mac:update 生成并验证签名更新包。');
if (withUpdater && (!configuration || !process.env.TAURI_SIGNING_PRIVATE_KEY))
  throw new Error('更新打包需要应用更新地址、公钥与 TAURI_SIGNING_PRIVATE_KEY。');
await mkdir(path.join(root, 'work'), { recursive: true });
const temporary = await mkdtemp(path.join(root, 'work/update-build-'));
const args = [path.join(root, 'scripts/tauri.mjs'), 'build', '--ci', '--bundles', 'app'];
const env = { ...process.env };
try {
  if (development) {
    args.push('--config', devConfig);
    delete env.I_CALENDAR_UPDATE_ENDPOINT;
    delete env.I_CALENDAR_UPDATE_PUBKEY;
  }
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
    env.I_CALENDAR_UPDATE_ENDPOINT = configuration.endpoint;
    env.I_CALENDAR_UPDATE_PUBKEY = configuration.publicKey;
  }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      env,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Tauri 构建失败（${code}）`)),
    );
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
const source = path.join(native, 'target/release/bundle/macos', `${productName}.app`);
const app = path.join(root, 'outputs', development ? 'mac-dev' : 'mac', `${productName}.app`);
await mkdir(path.dirname(app), { recursive: true });
await rm(app, { recursive: true, force: true });
await cp(source, app, { recursive: true });
await run('codesign', ['--verify', '--deep', '--strict', app]);
const { stdout: signedPlist } = await run('codesign', ['-d', '--entitlements', '-', '--xml', app]);
const entitlements = JSON.parse(
  execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], {
    input: signedPlist,
    encoding: 'utf8',
  }),
);
if (entitlements['com.apple.security.personal-information.location'] !== true)
  throw new Error('Mac 签名缺少系统定位能力');
const archive = path.join(root, `outputs/${productName}-${version}-mac-${process.arch}.zip`);
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
  `Mac 应用：${app}\n本地压缩包：${archive}\n当前使用本地签名，未通过 Apple 公证；发布时须明确说明安装与验证方式。`,
);

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const root = fileURLToPath(new URL('../', import.meta.url));

export function httpsAddress(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new Error('更新地址必须使用无凭据、无片段的 HTTPS 地址。');
  return url.href;
}

/** 只接受公钥内容，私钥仅通过官方 Tauri 签名环境变量传给构建工具。 */
export function updateConfiguration(env = process.env) {
  const endpoint = env.I_CALENDAR_UPDATE_ENDPOINT?.trim();
  const publicKey = env.I_CALENDAR_UPDATE_PUBKEY?.trim();
  if (!endpoint && !publicKey) return null;
  if (!endpoint || !publicKey) throw new Error('应用更新地址与公钥必须同时配置。');
  const decoded = Buffer.from(publicKey, 'base64').toString('utf8');
  const key = decoded.split(/\r?\n/)[1] ?? '';
  if (
    Buffer.from(decoded).toString('base64') !== publicKey ||
    !decoded.startsWith('untrusted comment:') ||
    Buffer.from(key, 'base64').length !== 42
  )
    throw new Error('更新公钥无效，请填写 tauri signer generate 生成的 .pub 文件内容。');
  return { endpoint: httpsAddress(endpoint), publicKey };
}

/** 使用官方 updater 的 verify 同时验证文件签名和签名绑定的版本，不请求网络。 */
export async function verifyUpdate(manifest, archive, target, publicKey) {
  await mkdir(path.join(root, 'work'), { recursive: true });
  const temporary = await mkdtemp(path.join(root, 'work/update-verify-'));
  try {
    const keyFile = path.join(temporary, 'update.pub');
    const manifestFile = path.join(temporary, 'latest.json');
    await writeFile(keyFile, publicKey);
    await writeFile(manifestFile, JSON.stringify(manifest));
    await run(
      'cargo',
      [
        'run',
        '--locked',
        '--quiet',
        '--manifest-path',
        path.join(root, 'apps/calendar/src-tauri/Cargo.toml'),
        '--example',
        'verify-update',
        '--',
        keyFile,
        manifestFile,
        path.resolve(archive),
        target,
      ],
      { cwd: root, maxBuffer: 2_000_000 },
    );
    // 签名不绑定平台；再检查包内实际可执行文件，避免把 arm64 包误列为 Intel。
    const expected = { 'darwin-aarch64': 'arm64', 'darwin-x86_64': 'x86_64' }[target];
    if (!expected) throw new Error('不支持的 Mac 更新目标。');
    const { stdout: executable } = await run(
      '/usr/bin/tar',
      ['-xOf', path.resolve(archive), 'i日历.app/Contents/MacOS/i-calendar'],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
    );
    const binary = path.join(temporary, 'i-calendar');
    await writeFile(binary, executable);
    const { stdout: architectures } = await run('/usr/bin/lipo', ['-archs', binary]);
    if (!architectures.trim().split(/\s+/).includes(expected))
      throw new Error(`更新包实际架构与 ${target} 不一致。`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function signedPlatform(archive, url) {
  if (!archive.endsWith('.app.tar.gz')) throw new Error('更新包必须为 .app.tar.gz。');
  const signature = (await readFile(`${archive}.sig`, 'utf8')).trim();
  if (!signature) throw new Error('更新包缺少签名。');
  return { url: httpsAddress(url), signature };
}

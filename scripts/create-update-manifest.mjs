import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { root, signedPlatform, updateConfiguration, verifyUpdate } from './update-release.mjs';

const { values } = parseArgs({
  options: {
    arm64: { type: 'string' },
    'arm64-url': { type: 'string' },
    x64: { type: 'string' },
    'x64-url': { type: 'string' },
    notes: { type: 'string' },
    output: { type: 'string', default: path.join(root, 'outputs/latest.json') },
  },
});
if (process.platform !== 'darwin') throw new Error('Mac 更新清单需要在 macOS 上验签生成。');
const configuration = updateConfiguration();
if (!configuration) throw new Error('请先配置应用更新地址与公钥。');
if (!values.notes) throw new Error('请使用 --notes 指定中文版本说明文件。');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const notes = (await readFile(values.notes, 'utf8')).trim();
if (!notes || notes.length > 20_000) throw new Error('版本说明须为 1 至 20000 个字符。');
const manifest = { version, notes, pub_date: new Date().toISOString(), platforms: {} };
const targets = [
  ['arm64', 'darwin-aarch64'],
  ['x64', 'darwin-x86_64'],
];
for (const [architecture, target] of targets) {
  const archive = values[architecture];
  const url = values[`${architecture}-url`];
  if (!archive && !url) continue;
  if (!archive || !url) throw new Error(`${architecture} 更新包与下载地址必须一起指定。`);
  manifest.platforms[target] = await signedPlatform(archive, url);
}
if (!Object.keys(manifest.platforms).length) throw new Error('至少指定一个架构的更新包。');
for (const [architecture, target] of targets) {
  if (manifest.platforms[target])
    await verifyUpdate(manifest, values[architecture], target, configuration.publicKey);
}
const output = path.resolve(values.output);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
await rename(`${output}.tmp`, output);
console.log(`已验签并生成更新清单：${output}\n请先发布签名更新包，最后发布清单。`);

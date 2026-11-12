import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sections = ['拾日历第三方组件许可证\n本文件由锁定依赖及其随附许可证生成，包含 Rust 构建依赖。\n'];
const npmPackages = execFileSync('npm', ['ls', '--omit=dev', '--parseable', '--all'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter((directory) => directory !== root.replace(/\/$/, ''));
async function append(directory, name, license, explicitLicense) {
  const files = (await readdir(directory)).filter((file) => /^(licen[sc]e|copying|copyright|notice)(\b|[-.])/i.test(file));
  if (explicitLicense && !files.includes(explicitLicense)) files.push(explicitLicense);
  const texts = [];
  for (const file of files) {
    try { texts.push(`${file}\n${await readFile(path.join(directory, file), 'utf8')}`); } catch { /* 部分包使用许可证子目录，保留 SPDX 标识与包名。 */ }
  }
  sections.push(`\n${'='.repeat(72)}\n${name}\n许可证：${license ?? '见随附文件'}\n${texts.join('\n\n')}\n`);
}
for (const directory of [...new Set(npmPackages)].sort()) {
  const data = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  await append(directory, `${data.name}@${data.version}`, data.license);
}
if (process.argv.includes('--web')) {
  sections.push(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'));
  await writeFile(path.join(root, 'apps/calendar/public/third-party-licenses.txt'), sections.join('\n'));
  console.log('已生成网页随附的第三方许可证。');
  process.exit(0);
}
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version', '1'], { cwd: path.join(root, 'apps/calendar/src-tauri'), encoding: 'utf8', maxBuffer: 12_000_000 }));
for (const dependency of metadata.packages.filter((item) => item.source).sort((a, b) => a.name.localeCompare(b.name))) {
  await append(path.dirname(dependency.manifest_path), `${dependency.name}@${dependency.version}`, dependency.license, dependency.license_file);
}
await mkdir(path.join(root, 'work'), { recursive: true });
await writeFile(path.join(root, 'work/第三方许可证.txt'), sections.join('\n'));
console.log(`已汇总 ${npmPackages.length} 个前端依赖及 ${metadata.packages.length - 1} 个 Rust 依赖的许可信息。`);

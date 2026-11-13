import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** 按标签从完整 Release 列表选择，草稿不能通过 published-by-tag 接口可靠读取。 */
export function selectRelease(releases, tag) {
  const matches = releases.filter((release) => release.tag_name === tag);
  assert.ok(matches.length <= 1, '同一标签存在多个 Release，拒绝猜测发布对象');
  return matches[0] ?? null;
}

/** GitHub 会规范化中文附件名；分发时只改外部名称与清单地址，保持签名载荷字节不变。 */
export async function preparePublication(folder, version, repository) {
  const target = path.join(folder, 'publication');
  await mkdir(target, { recursive: true });
  const files = [];
  for (const suffix of ['zip', 'app.tar.gz', 'app.tar.gz.sig']) {
    const source = `i日历-${version}-mac-arm64.${suffix}`;
    const name = `i-calendar-${version}-mac-arm64.${suffix}`;
    const data = await readFile(path.join(folder, source));
    await writeFile(path.join(target, name), data);
    files.push({ name, file: path.join(target, name), originalDigest: sha256(data) });
  }
  const original = await readFile(path.join(folder, 'latest.json'));
  const manifest = JSON.parse(original);
  assert.equal(manifest.version, version, '更新清单版本不一致');
  assert.deepEqual(Object.keys(manifest.platforms), ['darwin-aarch64']);
  manifest.platforms['darwin-aarch64'].url =
    `https://github.com/${repository}/releases/download/v${version}/i-calendar-${version}-mac-arm64.app.tar.gz`;
  const manifestFile = path.join(target, 'latest.json');
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const checksumFiles = [...files, { name: 'latest.json', file: manifestFile }];
  const sums = await Promise.all(
    checksumFiles.map(async ({ name, file }) => `${sha256(await readFile(file))}  ${name}`),
  );
  const checksumFile = path.join(target, 'SHA256SUMS.txt');
  await writeFile(checksumFile, `${sums.join('\n')}\n`);
  files.push({
    name: 'SHA256SUMS.txt',
    file: checksumFile,
    originalDigest: sha256(await readFile(path.join(folder, 'SHA256SUMS.txt'))),
  });
  files.push({ name: 'latest.json', file: manifestFile, originalDigest: sha256(original) });
  return files;
}

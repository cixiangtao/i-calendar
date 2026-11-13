import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { selectRelease } from './github-release.mjs';
import { releaseMetadata } from './release-context.mjs';

// 本地只能准备和验证；真正的发布由唯一 Actions 工作流执行。
assert.equal(process.env.GITHUB_ACTIONS, 'true', '正式发布只允许在 GitHub Actions 执行');
const run = promisify(execFile);
const gh = async (...args) => (await run('gh', args, { maxBuffer: 4_000_000 })).stdout;
const api = async (endpoint) => JSON.parse(await gh('api', endpoint));
const lookup = async (endpoint) => {
  try {
    return await api(endpoint);
  } catch (error) {
    if (error.stderr?.includes('HTTP 404')) return null;
    throw error;
  }
};
const config = JSON.parse(await readFile(new URL('../release/config.json', import.meta.url)));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const { tag, repository } = releaseMetadata(
  version,
  process.env.RELEASE_TAG,
  process.env.GITHUB_REPOSITORY,
  config,
);
const commit = process.env.RELEASE_COMMIT;
assert.match(commit ?? '', /^[a-f0-9]{40}$/);
assert.equal((await api(`repos/${repository}/commits/${tag}`)).sha, commit, '远程标签已变化');
const latest = await lookup(`repos/${repository}/releases/latest`);
if (latest) {
  const previous = latest.tag_name.replace(/^v/, '').split('.').map(Number);
  const current = version.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    assert.ok(previous[i] <= current[i], '禁止旧版本覆盖最新发布');
    if (previous[i] < current[i]) break;
  }
}
const folder = path.resolve(process.env.ASSET_DIRECTORY ?? 'release-assets');
const payloads = [
  `i日历-${version}-mac-arm64.zip`,
  `i日历-${version}-mac-arm64.app.tar.gz`,
  `i日历-${version}-mac-arm64.app.tar.gz.sig`,
  'SHA256SUMS.txt',
  // 更新清单始终最后上传；所有产物就绪后才公开整个 Release。
  'latest.json',
];
const digest = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
let release = selectRelease(
  JSON.parse(
    await gh('api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`),
  ).flat(),
  tag,
);
if (!release) {
  await gh(
    'release',
    'create',
    tag,
    '--repo',
    repository,
    '--verify-tag',
    '--target',
    commit,
    '--draft',
    '--title',
    `i日历 ${version}`,
    '--notes-file',
    `docs/releases/${version}.md`,
  );
  release = selectRelease(
    JSON.parse(
      await gh('api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`),
    ).flat(),
    tag,
  );
}
assert.ok(release, '未找到已创建的草稿 Release');
assert.equal(release.prerelease, false);
for (const name of payloads) {
  const file = path.join(folder, name);
  const expected = await digest(file);
  const existing = release.assets.find((asset) => asset.name === name);
  if (existing) {
    if (existing.digest)
      assert.equal(existing.digest, `sha256:${expected}`, `已存在产物不同：${name}`);
    else {
      const temporary = await mkdtemp(path.join(os.tmpdir(), 'i-calendar-published-'));
      try {
        await gh(
          'release',
          'download',
          tag,
          '--repo',
          repository,
          '--pattern',
          name,
          '--dir',
          temporary,
        );
        assert.equal(await digest(path.join(temporary, name)), expected, `已存在产物不同：${name}`);
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }
  } else await gh('release', 'upload', tag, file, '--repo', repository);
}
release = await api(`repos/${repository}/releases/${release.id}`);
for (const name of payloads) assert.ok(release.assets.some((asset) => asset.name === name));
await gh(
  'api',
  '--method',
  'PATCH',
  `repos/${repository}/releases/${release.id}`,
  '-F',
  'draft=false',
  '-F',
  'prerelease=false',
  '-f',
  'make_latest=true',
);
console.log(`已发布正式版本：https://github.com/${repository}/releases/tag/${tag}`);

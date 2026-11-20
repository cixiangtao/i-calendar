import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { createDraftRelease, preparePublication, selectRelease } from './github-release.mjs';
import { releaseMetadata } from './release-context.mjs';
import { assertVersionAdvance } from './release-semver.mjs';

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
if (latest) assertVersionAdvance(latest.tag_name.replace(/^v/, ''), version, { allowSame: true });
const folder = path.resolve(process.env.ASSET_DIRECTORY ?? 'release-assets');
const payloads = await preparePublication(folder, version, repository);
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
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'i-calendar-draft-'));
  try {
    release = await createDraftRelease(
      async (body) => {
        const request = path.join(temporary, 'release.json');
        await writeFile(request, JSON.stringify(body));
        return JSON.parse(
          await gh('api', '--method', 'POST', `repos/${repository}/releases`, '--input', request),
        );
      },
      { tag, version, notes: await readFile(`docs/releases/${version}.md`, 'utf8') },
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
assert.ok(release, '未找到已创建的草稿 Release');
assert.equal(release.prerelease, false);
for (const { name, file, originalDigest } of payloads) {
  const expected = await digest(file);
  const existing =
    release.assets.find((asset) => asset.name === name) ??
    release.assets.find((asset) => asset.digest === `sha256:${expected}`);
  if (existing) {
    if (existing.digest && existing.digest !== `sha256:${expected}`) {
      // 首次公开前允许纠正自己生成的分发元数据，不改动已验签的二进制载荷。
      assert.ok(release.draft && ['latest.json', 'SHA256SUMS.txt'].includes(name));
      assert.equal(existing.digest, `sha256:${originalDigest}`, `草稿元数据来源不同：${name}`);
      await gh('release', 'upload', tag, file, '--repo', repository, '--clobber');
    } else if (existing.digest) {
      if (existing.name !== name) {
        assert.ok(release.draft, '禁止更改已公开的附件名称');
        await gh(
          'api',
          '--method',
          'PATCH',
          `repos/${repository}/releases/assets/${existing.id}`,
          '-f',
          `name=${name}`,
        );
      }
    } else {
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
for (const { name, file } of payloads) {
  const asset = release.assets.find((item) => item.name === name);
  assert.ok(asset, `附件名称不一致：${name}`);
  if (asset.digest) assert.equal(asset.digest, `sha256:${await digest(file)}`);
}
assert.equal((await api(`repos/${repository}/commits/${tag}`)).sha, commit, '远程标签已变化');
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

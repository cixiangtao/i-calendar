import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertVersionAdvance, nextStableVersion, parseStableVersion } from './release-semver.mjs';

const nonAppScopes = new Set(['web', 'release', 'dev', 'ci']);

function commitLevel(subject, body) {
  const header = /^([a-z][a-z-]*)(?:\(([^()\n]+)\))?(!)?:\s/.exec(subject);
  if (!header || nonAppScopes.has(header[2])) return;
  if (header[3] || /^BREAKING[ -]CHANGE:[ \t]+\S/m.test(body)) return 'major';
  if (header[1] === 'feat') return 'minor';
  if (header[1] === 'fix') return 'patch';
}

/** 从最新公开正式版推导一次应用版本递增。 */
export async function planRelease(root, current, supersededTag) {
  parseStableVersion(current);
  const { repository } = JSON.parse(await readFile(path.join(root, 'release/config.json'), 'utf8'));
  const releases = `https://api.github.com/repos/${repository}/releases`;
  const response = await fetch(`${releases}/latest`, {
    signal: AbortSignal.timeout(10_000),
  }).catch((cause) => {
    throw new Error('无法查询 GitHub 最新正式版本', { cause });
  });
  assert.ok(response.ok, `无法查询 GitHub 最新正式版本（HTTP ${response.status}）`);
  const { tag_name: tag, draft, prerelease } = await response.json();
  assert.ok(draft === false && prerelease === false, 'GitHub 最新版本必须是公开正式版');
  assert.equal(typeof tag, 'string', '缺少 GitHub 正式版本标签');
  const published = tag.slice(1);
  parseStableVersion(published);
  assert.equal(tag, `v${published}`, 'GitHub 正式版本标签格式不正确');

  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (supersededTag) {
    assert.equal(supersededTag, `v${current}`, '待替代标签必须对应当前源码版本');
    assertVersionAdvance(published, current);
    const candidateRef = `refs/tags/${supersededTag}`;
    const remoteTag = git('ls-remote', '--exit-code', 'origin', candidateRef).trim();
    assert.equal(remoteTag, `${git('rev-parse', candidateRef).trim()}\t${candidateRef}`);
    git('merge-base', '--is-ancestor', candidateRef, 'origin/main');
    const candidateRelease = await fetch(`${releases}/tags/${supersededTag}`, {
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(candidateRelease.status, 404, '只有未公开的候选标签可替代');
  } else {
    assert.equal(tag, `v${current}`, '本地版本与 GitHub 最新正式版不一致，请先核实发布现场');
  }
  const ref = `refs/tags/${tag}`;
  try {
    git('merge-base', '--is-ancestor', ref, 'HEAD');
  } catch (cause) {
    throw new Error(`正式标签 ${tag} 必须存在且属于当前分支历史`, { cause });
  }
  const fields = git('log', '-z', '--format=%h%x00%s%x00%b', `${ref}..HEAD`).split('\0');
  const commits = [];
  for (let index = 0; index + 2 < fields.length; index += 3) {
    const [hash, subject, body] = fields.slice(index, index + 3);
    const level = commitLevel(subject, body);
    if (level) commits.push({ hash, subject, level });
  }
  const level = ['major', 'minor', 'patch'].find((candidate) =>
    commits.some((commit) => commit.level === candidate),
  );
  if (!level) return { current, published, commits };
  const planned = nextStableVersion(published, level);
  const version = planned === current ? nextStableVersion(current, level) : planned;
  assertVersionAdvance(current, version);
  return { current, published, commits, level, version };
}

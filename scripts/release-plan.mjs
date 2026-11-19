import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { nextStableVersion, parseStableVersion } from './release-semver.mjs';

const nonAppScopes = new Set(['web', 'release', 'dev', 'ci']);

function commitLevel(subject, body) {
  const header = /^([a-z][a-z-]*)(?:\(([^()\n]+)\))?(!)?:\s/.exec(subject);
  if (!header || nonAppScopes.has(header[2])) return;
  if (header[3] || /^BREAKING[ -]CHANGE:[ \t]+\S/m.test(body)) return 'major';
  if (header[1] === 'feat') return 'minor';
  if (header[1] === 'fix') return 'patch';
}

/** 从最新公开正式版推导一次应用版本递增。 */
export async function planRelease(root, current) {
  parseStableVersion(current);
  const { repository } = JSON.parse(await readFile(path.join(root, 'release/config.json'), 'utf8'));
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    signal: AbortSignal.timeout(10_000),
  }).catch((cause) => {
    throw new Error('无法查询 GitHub 最新正式版本', { cause });
  });
  assert.ok(response.ok, `无法查询 GitHub 最新正式版本（HTTP ${response.status}）`);
  const { tag_name: tag, draft, prerelease } = await response.json();
  assert.ok(draft === false && prerelease === false, 'GitHub 最新版本必须是公开正式版');
  assert.equal(tag, `v${current}`, '本地版本与 GitHub 最新正式版不一致，请先核实发布现场');

  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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
  if (!level) return { current, commits };
  return { current, commits, level, version: nextStableVersion(current, level) };
}

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseStableVersion } from './release-semver.mjs';
import { root, updateConfiguration } from './update-release.mjs';

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

/** 稳定版本、标签和目标仓库必须完全对应，避免普通分支或旧预览误发布。 */
export function releaseMetadata(version, tag, repository, config) {
  parseStableVersion(version);
  assert.equal(tag, `v${version}`, '标签与应用版本不一致');
  assert.equal(repository, config.repository, '发布仓库不一致');
  const updater = updateConfiguration({
    I_CALENDAR_UPDATE_ENDPOINT: config.updateEndpoint,
    I_CALENDAR_UPDATE_PUBKEY: config.publicKey,
  });
  assert.ok(updater, '缺少正式更新配置');
  return { version, tag, repository, ...updater };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', '此入口只准备 GitHub Actions 发布上下文');
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const config = JSON.parse(await readFile(path.join(root, 'release/config.json'), 'utf8'));
  const metadata = releaseMetadata(
    version,
    process.env.RELEASE_TAG,
    process.env.GITHUB_REPOSITORY,
    config,
  );
  const commit = git('rev-parse', 'HEAD');
  assert.equal(git('rev-parse', `refs/tags/${metadata.tag}^{commit}`), commit);
  git('merge-base', '--is-ancestor', commit, 'origin/main');
  for (const file of [
    'packages/calendar-core/package.json',
    'packages/calendar-ui/package.json',
    'apps/calendar/src-tauri/tauri.conf.json',
  ])
    assert.equal(JSON.parse(await readFile(path.join(root, file), 'utf8')).version, version, file);
  const cargo = await readFile(path.join(root, 'apps/calendar/src-tauri/Cargo.toml'), 'utf8');
  assert.ok(cargo.includes(`name = "i-calendar"\nversion = "${version}"`));
  await readFile(path.join(root, `docs/releases/${version}.md`), 'utf8');
  await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\ncommit=${commit}\n`);
  await appendFile(
    process.env.GITHUB_ENV,
    `I_CALENDAR_UPDATE_ENDPOINT=${metadata.endpoint}\nI_CALENDAR_UPDATE_PUBKEY=${metadata.publicKey}\n`,
  );
  console.log(`已校验正式发布：${metadata.repository} ${metadata.tag} ${commit}`);
}

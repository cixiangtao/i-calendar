import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const jsonFiles = [
  'package.json',
  'packages/calendar-core/package.json',
  'packages/calendar-ui/package.json',
  'apps/calendar/src-tauri/tauri.conf.json',
];
const cargoFile = 'apps/calendar/src-tauri/Cargo.toml';
const lockFile = 'apps/calendar/src-tauri/Cargo.lock';
const documentPatterns = {
  'README.md': /当前版本 \*\*([\d.]+)\*\*/,
  'AGENTS.md': /当前版本为 ([\d.]+)。/,
  'docs/版本规划.md': /## 当前状态：([\d.]+)/,
};
const releaseFiles = [...jsonFiles, cargoFile, lockFile, ...Object.keys(documentPatterns)];
const read = (root, file) => readFile(path.join(root, file), 'utf8');
const git = (root, ...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function stableVersion(version) {
  assert.match(version, /^[1-9]\d*\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, '只允许 1.0.0 起的正式版本');
  return version.split('.').map(BigInt);
}

/** 发布前后统一核对所有版本位置；不将 Cargo.lock 当普通文本替换。 */
export async function verifyVersions(root, expected) {
  stableVersion(expected);
  for (const file of jsonFiles)
    assert.equal(JSON.parse(await read(root, file)).version, expected, `${file} 版本不一致`);
  const cargo = await read(root, cargoFile);
  const lock = await read(root, lockFile);
  assert.equal(
    cargo.match(/\[package\]\s+name = "i-calendar"\s+version = "([^"]+)"/)?.[1],
    expected,
  );
  assert.equal(
    lock.match(/\[\[package\]\]\s+name = "i-calendar"\s+version = "([^"]+)"/)?.[1],
    expected,
  );
  for (const [file, pattern] of Object.entries(documentPatterns))
    assert.equal((await read(root, file)).match(pattern)?.[1], expected, `${file} 当前版本不一致`);
}

/** 包括未跟踪文件在内的只读门禁，取代 release-it 的破坏性自动回滚。 */
export async function guardRelease(root = process.cwd()) {
  assert.equal(git(root, 'branch', '--show-current'), 'main', '只允许从 main 发布');
  assert.equal(git(root, 'rev-parse', '--abbrev-ref', '@{upstream}'), 'origin/main');
  assert.equal(git(root, 'status', '--porcelain'), '', '工作区必须干净，包括未跟踪文件');
  const config = JSON.parse(await read(root, 'release/config.json'));
  const origin = git(root, 'config', '--get', 'remote.origin.url');
  assert.ok(
    [
      `https://github.com/${config.repository}.git`,
      `git@github.com:${config.repository}.git`,
    ].includes(origin),
    'origin 与正式发布仓库不一致',
  );
  const { version } = JSON.parse(await read(root, 'package.json'));
  await verifyVersions(root, version);
}

/** 在任何版本写入前拒绝旧版本、预览版、缺失说明和落后于远端的分支。 */
export async function validateRelease(root, version) {
  const next = stableVersion(version);
  const current = JSON.parse(await read(root, 'package.json')).version;
  const previous = stableVersion(current);
  const differing = next.findIndex((part, index) => part !== previous[index]);
  assert.ok(differing >= 0 && next[differing] > previous[differing], '新版本必须高于当前版本');
  await verifyVersions(root, current);
  git(root, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD');
  git(root, 'merge-base', '--is-ancestor', `refs/tags/v${current}`, 'origin/main');
  const existing = git(root, 'tag', '--list', `v${version}`);
  assert.equal(existing, '', '版本标签已存在，请核实发布现场，不移动旧标签');
  const notesPath = `docs/releases/${version}.md`;
  git(root, 'ls-files', '--error-unmatch', notesPath);
  const notes = await read(root, notesPath);
  assert.ok(notes.startsWith(`# i日历 ${version}\n`), '版本说明标题与目标版本不一致');
  assert.ok(
    notes.trim().length > 50 && /[\u4e00-\u9fff]/.test(notes),
    '请先提交完整的中文版本说明',
  );
}

/** 一个版本拥有者：JSON 清单、Cargo 和当前版本文档一起同步。 */
export async function syncVersions(root, version) {
  stableVersion(version);
  const { version: current } = JSON.parse(await read(root, 'package.json'));
  await verifyVersions(root, current);
  const changes = [];
  for (const file of jsonFiles) {
    const manifest = JSON.parse(await read(root, file));
    changes.push([file, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`]);
  }
  changes.push([
    cargoFile,
    (await read(root, cargoFile)).replace(
      `name = "i-calendar"\nversion = "${current}"`,
      `name = "i-calendar"\nversion = "${version}"`,
    ),
  ]);
  for (const [file, pattern] of Object.entries(documentPatterns)) {
    let document = (await read(root, file)).replace(pattern, (match) =>
      match.replace(current, version),
    );
    if (file === 'README.md')
      document = document.replace(
        `i日历-${current}-mac-arm64.zip`,
        `i日历-${version}-mac-arm64.zip`,
      );
    changes.push([file, document]);
  }
  for (const [file, content] of changes) await writeFile(path.join(root, file), content);
  execFileSync('cargo', ['update', '--offline', '--workspace', '--manifest-path', cargoFile], {
    cwd: root,
    stdio: 'inherit',
  });
  execFileSync('pnpm', ['exec', 'oxfmt', '--write', ...changes.map(([file]) => file)], {
    cwd: root,
    stdio: 'inherit',
  });
  await verifyVersions(root, version);
}

/** Release-it 暂存后只允许版本元数据进入自动发布提交。 */
export async function verifyRelease(root, version) {
  await verifyVersions(root, version);
  assert.equal(git(root, 'diff', '--name-only'), '', '检查产生了未暂存修改，请先核实');
  assert.equal(git(root, 'ls-files', '--others', '--exclude-standard'), '', '检查产生了未跟踪文件');
  const staged = git(root, 'diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
  assert.ok(staged.length > 0, '发布提交必须包含版本变更');
  for (const file of staged)
    assert.ok(releaseFiles.includes(file), `发布提交混入非版本文件：${file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [action, version] = process.argv.slice(2);
  const actions = {
    guard: guardRelease,
    validate: validateRelease,
    sync: syncVersions,
    verify: verifyRelease,
  };
  assert.ok(Object.hasOwn(actions, action), '使用 guard / validate / sync / verify 子命令');
  await actions[action](process.cwd(), version);
  console.log(`PASS：发布${action}${version ? ` ${version}` : ''}`);
}

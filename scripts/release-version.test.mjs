import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertVersionAdvance } from './release-semver.mjs';
import { guardRelease, syncVersions, validateRelease, verifyVersions } from './release-version.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' };
for (const key of Object.keys(env))
  if (/^GIT_(CONFIG_(COUNT|KEY_\d+|VALUE_\d+)|DIR|WORK_TREE|INDEX_FILE)$/.test(key))
    delete env[key];
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();

async function fixture() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'i-calendar-release-'));
  const root = path.join(folder, 'source');
  const remote = path.join(folder, 'remote.git');
  await mkdir(root);
  const files = {
    'package.json': JSON.stringify({
      name: 'i-calendar',
      version: '1.0.0',
      private: true,
      type: 'module',
    }),
    'packages/calendar-core/package.json': '{"version":"1.0.0"}',
    'packages/calendar-ui/package.json': '{"version":"1.0.0"}',
    'apps/calendar/src-tauri/tauri.conf.json': '{"version":"1.0.0"}',
    'apps/calendar/src-tauri/Cargo.toml':
      '[package]\nname = "i-calendar"\nversion = "1.0.0"\nedition = "2021"\n',
    'apps/calendar/src-tauri/Cargo.lock':
      'version = 4\n\n[[package]]\nname = "i-calendar"\nversion = "1.0.0"\n',
    'apps/calendar/src-tauri/src/lib.rs': '',
    'README.md': '当前版本 **1.0.0**。\n\n产物为 `i日历-1.0.0-mac-arm64.zip`。\n',
    'AGENTS.md': '当前版本为 1.0.0。\n',
    'docs/版本规划.md': '# 版本规划\n\n## 当前状态：1.0.0\n',
    'docs/releases/1.0.1.md': `# i日历 1.0.1\n\n${'测试正式发布、多端版本同步、原子推送和发布失败保留现场。'.repeat(3)}\n`,
    '.gitignore': 'node_modules/\n**/target/\n',
    'release/config.json': '{"repository":"cixiangtao/i-calendar"}',
  };
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  await mkdir(path.join(root, 'scripts'));
  for (const file of ['release-semver.mjs', 'release-version.mjs', 'release-version-plugin.mjs'])
    await copyFile(path.join(source, 'scripts', file), path.join(root, 'scripts', file));
  await symlink(path.join(source, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const config = JSON.parse(await readFile(path.join(source, 'release/release-it.json')));
  // 会话检查单独测试；隔离 Git 仓库不启动原生窗口，也不依赖宿主是否锁屏。
  config.hooks['before:init'] = 'node scripts/release-version.mjs guard';
  // 隔离仓库只检验编排与阻断传播；实际产品质量门禁由正式配置执行。
  config.hooks['after:bump'] = 'node -e "process.exit(Number(process.env.RELEASE_TEST_GATE || 0))"';
  await writeFile(path.join(root, 'release/release-it.json'), JSON.stringify(config));
  git(folder, 'init', '--bare', '--initial-branch=main', remote);
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.name', '发布流程测试');
  git(root, 'config', 'user.email', 'release-test@example.invalid');
  git(root, 'config', `url.${remote}.insteadOf`, 'https://github.com/cixiangtao/i-calendar.git');
  git(root, 'remote', 'add', 'origin', 'https://github.com/cixiangtao/i-calendar.git');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'test(release): ✅ 初始化隔离发布仓库');
  git(root, 'tag', '-a', 'v1.0.0', '-m', '历史正式版');
  git(root, 'push', '--set-upstream', 'origin', 'main', '--tags');
  await writeFile(path.join(root, 'change.txt'), '待发布修改');
  git(root, 'add', 'change.txt');
  git(root, 'commit', '-m', 'build(release): 📦️ 验证发布工具');
  return { root, remote, cleanup: () => rm(folder, { recursive: true, force: true }) };
}

async function release(root, args = [], extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(source, 'node_modules/release-it/bin/release-it.js'),
        'patch',
        '--ci',
        '--config',
        'release/release-it.json',
        ...args,
      ],
      { cwd: root, env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

test('release-it 预演不改清单、工作区、提交或本地与远端标签', async () => {
  const { root, remote, cleanup } = await fixture();
  try {
    const head = git(root, 'rev-parse', 'HEAD');
    const refs = git(remote, 'show-ref');
    const result = await release(root, ['--dry-run']);
    assert.equal(result.code, 0, result.output);
    await verifyVersions(root, '1.0.0');
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.equal(git(root, 'rev-parse', 'HEAD'), head);
    assert.equal(git(root, 'tag', '--list', 'v1.0.1'), '');
    assert.equal(git(remote, 'show-ref'), refs);
    assert.ok(result.output.includes('git push --atomic'));
  } finally {
    await cleanup();
  }
});

test('release-it 同步所有版本并创建中文发布提交和附注标签，原子推送到同一提交', async () => {
  const { root, remote, cleanup } = await fixture();
  try {
    const result = await release(root);
    assert.equal(result.code, 0, result.output);
    await verifyVersions(root, '1.0.1');
    const head = git(root, 'rev-parse', 'HEAD');
    assert.equal(git(root, 'log', '-1', '--pretty=%s'), 'chore(release): 🔨 发布 1.0.1 正式版');
    assert.equal(git(root, 'cat-file', '-t', 'v1.0.1'), 'tag');
    assert.equal(git(remote, 'rev-parse', 'main'), head);
    assert.equal(git(remote, 'rev-parse', 'v1.0.1^{commit}'), head);
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.ok(
      (await readFile(path.join(root, 'README.md'), 'utf8')).includes('i日历-1.0.1-mac-arm64.zip'),
    );
    assert.equal(git(root, 'ls-files', '*lock*'), 'apps/calendar/src-tauri/Cargo.lock');
  } finally {
    await cleanup();
  }
});

test('缺少版本说明、预览版本与不干净工作区在写入前拒绝', async () => {
  const { root, cleanup } = await fixture();
  try {
    await assert.rejects(validateRelease(root, '1.0.1-beta.1'), /正式版本/);
    await assert.rejects(validateRelease(root, '1.00.1'), /无前导零/);
    await assert.rejects(validateRelease(root, '2.0.1'), /须归零/);
    await assert.rejects(syncVersions(root, '1.1.1'), /须归零/);
    await verifyVersions(root, '1.0.0');
    await assert.rejects(validateRelease(root, '1.0.0'), /必须高于/);
    await assert.rejects(validateRelease(root, '1.0.2'));
    await writeFile(path.join(root, 'untracked.txt'), '用户文件');
    await assert.rejects(guardRelease(root), /工作区必须干净/);
    const result = await release(root);
    assert.notEqual(result.code, 0);
    await verifyVersions(root, '1.0.0');
    assert.equal(await readFile(path.join(root, 'untracked.txt'), 'utf8'), '用户文件');
  } finally {
    await cleanup();
  }
});

test('按数字比较三段版本，只在相同版本恢复时允许相等', () => {
  for (const target of ['1.3.9', '1.4.0', '1.10.0', '2.0.0'])
    assert.doesNotThrow(() => assertVersionAdvance('1.3.8', target));
  for (const target of ['1.03.9', '1.3.09', '1.3.9\n', '1.3.9+build'])
    assert.throws(() => assertVersionAdvance('1.3.8', target), /正式版本/);
  for (const target of ['1.4.8', '2.1.0'])
    assert.throws(() => assertVersionAdvance('1.3.8', target), /须归零/);
  assert.doesNotThrow(() => assertVersionAdvance('1.3.8', '1.3.8', { allowSame: true }));
  assert.throws(() => assertVersionAdvance('1.3.8', '1.3.7', { allowSame: true }), /必须高于/);
});

test('质量门禁失败保留版本差异供检查，不创建提交、标签或远端修改', async () => {
  const { root, remote, cleanup } = await fixture();
  try {
    const head = git(root, 'rev-parse', 'HEAD');
    const refs = git(remote, 'show-ref');
    const result = await release(root, [], { RELEASE_TEST_GATE: '7' });
    assert.notEqual(result.code, 0, result.output);
    await verifyVersions(root, '1.0.1');
    assert.equal(git(root, 'rev-parse', 'HEAD'), head);
    assert.equal(git(root, 'tag', '--list', 'v1.0.1'), '');
    assert.equal(git(remote, 'show-ref'), refs);
    assert.ok(git(root, 'status', '--porcelain').includes('package.json'));
  } finally {
    await cleanup();
  }
});

test('原子推送遭拒时保留本地发布提交与标签，不删除历史标签或部分更新远端 main', async () => {
  const { root, remote, cleanup } = await fixture();
  try {
    const refs = git(remote, 'show-ref');
    await writeFile(path.join(remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const result = await release(root);
    assert.notEqual(result.code, 0, result.output);
    assert.equal(git(remote, 'show-ref'), refs);
    assert.equal(git(root, 'log', '-1', '--pretty=%s'), 'chore(release): 🔨 发布 1.0.1 正式版');
    assert.equal(git(root, 'rev-parse', 'v1.0.1^{commit}'), git(root, 'rev-parse', 'HEAD'));
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.ok(!result.output.includes('--delete'));
  } finally {
    await cleanup();
  }
});

test('版本同步先核对全部文件，已有版本不一致时拒绝写入', async () => {
  const { root, cleanup } = await fixture();
  try {
    await writeFile(path.join(root, 'packages/calendar-core/package.json'), '{"version":"0.9.0"}');
    await assert.rejects(syncVersions(root, '1.0.1'), /版本不一致/);
    assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'))).version, '1.0.0');
  } finally {
    await cleanup();
  }
});

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { checkNativeApp, resumeNativeChecks } from './native-app-check.mjs';

const ready = () => ({ ready: true, reason: null });
const locked = () => ({ ready: false, reason: 'Mac 当前处于锁屏状态' });
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'i-calendar-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = path.join(root, 'i-calendar');
  await writeFile(executable, '隔离测试产物');
  const calls = [];
  const run = async (_file, args) => {
    calls.push(args);
    return { stdout: 'PASS：Tauri\nPASS：开机自启模式', stderr: '' };
  };
  const report = async () => {
    const folder = path.join(root, 'work/native-checks');
    const names = await readdir(folder);
    assert.equal(names.length, 1);
    return JSON.parse(await readFile(path.join(folder, names[0]), 'utf8'));
  };
  return { root, executable, calls, report, run, env: {}, deferUnavailable: true };
}

test('锁屏不启动应用，持久记录待验；解锁复用同一二进制完成两种启动验证', async (t) => {
  const f = await fixture(t);
  const result = await checkNativeApp({ ...f, session: locked });
  assert.equal(result.status, 'pending');
  assert.equal((await f.report()).status, 'pending');
  assert.deepEqual(f.calls, []);
  await resumeNativeChecks({ ...f, session: ready });
  assert.deepEqual(f.calls, [['--smoke-test'], ['--smoke-test', '--autostart']]);
  assert.equal((await f.report()).status, 'passed');
  await resumeNativeChecks({ ...f, session: ready });
  assert.equal(f.calls.length, 2, '已完成的报告不会再次运行');
});

test('两次启动之间锁屏只保留部分结果，补验仍完整执行两种模式', async (t) => {
  const f = await fixture(t);
  let reads = 0;
  const result = await checkNativeApp({
    ...f,
    session: () => (reads++ === 0 ? ready() : locked()),
  });
  assert.equal(result.status, 'pending');
  assert.equal(result.results.length, 1);
  await resumeNativeChecks({ ...f, session: ready });
  assert.equal(f.calls.length, 3);
  assert.equal((await f.report()).results.length, 2);
});

test('运行中锁屏保留失败证据并标记待验，不声称通过', async (t) => {
  const f = await fixture(t);
  let reads = 0;
  const result = await checkNativeApp({
    ...f,
    session: () => (reads++ === 0 ? ready() : locked()),
    run: async () => {
      throw Object.assign(new Error('窗口轨迹失败'), { stderr: '保留原断言' });
    },
  });
  assert.equal(result.status, 'pending');
  assert.equal(result.lastFailure.stderr, '保留原断言');
  assert.equal((await f.report()).lastFailure.message, '窗口轨迹失败');
  await resumeNativeChecks({ ...f, session: locked });
  assert.equal((await f.report()).lastFailure.stderr, '保留原断言');
});

test('桌面可用时的失败和不完整通过标记仍然阻止检查', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    checkNativeApp({
      ...f,
      session: ready,
      run: async () => {
        throw new Error('真实测试失败');
      },
    }),
    /真实测试失败/,
  );
  await assert.rejects(
    checkNativeApp({ ...f, session: ready, run: async () => ({ stdout: '未通过', stderr: '' }) }),
    /前端验证/,
  );
  await assert.rejects(
    checkNativeApp({
      ...f,
      session: ready,
      run: async () => ({ stdout: 'PASS：Tauri', stderr: '' }),
    }),
    /后台启动/,
  );
});

test('补验前原产物被覆盖则拒绝执行，待验记录保持未通过', async (t) => {
  const f = await fixture(t);
  await checkNativeApp({ ...f, session: locked });
  await writeFile(f.executable, '另一版本');
  await assert.rejects(resumeNativeChecks({ ...f, session: ready }), /待验应用已变化/);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.report()).status, 'pending');
});

test('严格模式始终执行应用检查，CI 不接受延后开关', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    checkNativeApp({
      ...f,
      session: () => {
        throw new Error('不读取延后条件');
      },
      deferUnavailable: false,
      run: async () => {
        throw new Error('实际窗口失败');
      },
    }),
    /实际窗口失败/,
  );
  for (const env of [{ CI: 'true' }, { CI: '1' }, { GITHUB_ACTIONS: 'true' }])
    await assert.rejects(checkNativeApp({ ...f, session: ready, env }), /CI 不允许/);
  assert.equal(f.calls.length, 0);
});

test('验证期间产物被替换也不能记录通过', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    checkNativeApp({
      ...f,
      session: ready,
      run: async (...args) => {
        await writeFile(f.executable, '验证中被替换的二进制');
        return f.run(...args);
      },
    }),
    /验证期间应用已变化/,
  );
});

test('只有本地发布使用延后模式，正式云端配置仍运行严格窗口检查', async () => {
  const config = JSON.parse(
    await readFile(new URL('../release/release-it.json', import.meta.url), 'utf8'),
  );
  assert.ok(
    config.hooks['before:init'].includes(
      'node scripts/release-native-ready.mjs --defer-unavailable',
    ),
  );
  assert.ok(config.hooks['after:bump'].includes('pnpm run check:mac --defer-unavailable'));
  const workflow = await readFile(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8',
  );
  const smokeJob = workflow.split('\n  smoke:\n')[1]?.split('\n  publish:\n')[0];
  assert.match(smokeJob ?? '', /actions\/download-artifact@/);
  assert.match(smokeJob ?? '', /shasum -a 256 -c SHA256SUMS\.txt/);
  assert.match(smokeJob ?? '', /await checkNativeApp\(/);
  assert.match(workflow, /\n  publish:\n[^\n]+\n    needs: \[build, smoke\]/);
  assert.match(workflow, /needs\.smoke\.result == 'success'/);
  assert.match(workflow, /inputs\.local_smoke_sha256 && needs\.smoke\.result == 'skipped'/);
  assert.match(workflow, /assert\.equal\(GITHUB_REF, 'refs\/heads\/main'\)/);
  assert.match(workflow, /原构建未校验同一标签提交/);
  assert.match(workflow, /outputs\/i日历-%s-mac-arm64\.zip\\n.*shasum -a 256 -c/);
  assert.ok(!workflow.includes('--defer-unavailable'));
});

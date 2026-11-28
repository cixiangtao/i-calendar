import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { readNativeSession } from './release-native-ready.mjs';

const execute = promisify(execFile);
const modes = [['--smoke-test'], ['--smoke-test', '--autostart']];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reportsAt = (root) => path.join(root, 'work/native-checks');

function assertDeferralAllowed(deferUnavailable, env) {
  assert.ok(
    !deferUnavailable ||
      ![env.CI, env.GITHUB_ACTIONS].some((value) => value && !['false', '0'].includes(value)),
    'CI 不允许延后窗口检查',
  );
}

/** 产物验证与桌面可用性分开记录，待验从不记为通过。 */
export async function checkNativeApp({
  root,
  executable,
  deferUnavailable = false,
  expectedDigest,
  session = readNativeSession,
  run = execute,
  env = process.env,
}) {
  assertDeferralAllowed(deferUnavailable, env);
  executable = path.resolve(root, executable);
  const sha256 = digest(await readFile(executable));
  if (expectedDigest)
    assert.equal(sha256, expectedDigest, '待验应用已变化，请保留原产物后补验，不能沿用旧记录');
  const folder = reportsAt(root);
  const reportPath = path.join(folder, `${digest(`${executable}\n${sha256}`)}.json`);
  const report = {
    executable,
    sha256,
    status: 'pending',
    checkedAt: new Date().toISOString(),
    results: [],
  };
  const save = async () => {
    await mkdir(folder, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  };
  const defer = async (reason, failure) => {
    // 尚未实际重跑时保留上次的部分结果与错误，避免反复锁屏覆盖原始证据。
    if (!failure && !report.results.length) {
      try {
        const previous = JSON.parse(await readFile(reportPath, 'utf8'));
        if (previous.status === 'pending') {
          console.log(`仍待验：${reason}；保留原记录 ${reportPath}。`);
          return previous;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    report.reason = reason;
    if (failure)
      report.lastFailure = {
        message: failure.message,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? '',
      };
    await save();
    console.log(
      `待验：${reason}；记录 ${reportPath}。继续其他检查，桌面可用后运行 pnpm run check:mac --resume。`,
    );
    return report;
  };
  for (const args of modes) {
    assert.equal(
      digest(await readFile(executable)),
      sha256,
      '验证期间应用已变化，请使用同一产物重新检查',
    );
    if (deferUnavailable) {
      const desktop = session();
      if (!desktop.ready) return defer(desktop.reason);
    }
    try {
      const result = await run(executable, args, {
        cwd: root,
        env,
        timeout: 40_000,
        maxBuffer: 1_000_000,
      });
      assert.ok(
        result.stdout.includes('PASS：Tauri'),
        '原生应用未返回前端验证结果，请重新构建应用后重试。',
      );
      if (args.includes('--autostart'))
        assert.ok(result.stdout.includes('PASS：开机自启模式'), '原生应用未通过后台启动验证。');
      console.log(result.stdout.trim());
      report.results.push({
        mode: args.includes('--autostart') ? 'autostart' : 'normal',
        stdout: result.stdout,
        stderr: result.stderr ?? '',
      });
    } catch (error) {
      if (deferUnavailable) {
        const afterFailure = session();
        if (!afterFailure.ready) return defer(afterFailure.reason, error);
      }
      throw error;
    }
  }
  assert.equal(
    digest(await readFile(executable)),
    sha256,
    '验证期间应用已变化，请使用同一产物重新检查',
  );
  report.status = 'passed';
  await save();
  return report;
}

/** 复用原应用；路径被覆盖时摘要校验失败，不把新产物冒充旧产物。 */
export async function resumeNativeChecks({ root, ...options }) {
  assertDeferralAllowed(options.deferUnavailable, options.env ?? process.env);
  let names;
  try {
    names = await readdir(reportsAt(root));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    names = [];
  }
  let pending = 0;
  const failures = [];
  for (const name of names.filter((entry) => entry.endsWith('.json')).sort()) {
    try {
      const report = JSON.parse(await readFile(path.join(reportsAt(root), name), 'utf8'));
      if (report.status !== 'pending') continue;
      assert.ok(
        path.isAbsolute(report.executable) && /^[a-f0-9]{64}$/.test(report.sha256 ?? ''),
        '待验记录缺少原应用路径或摘要',
      );
      pending += 1;
      await checkNativeApp({
        ...options,
        root,
        executable: report.executable,
        expectedDigest: report.sha256,
      });
    } catch (error) {
      failures.push([name, error.message, error.stdout, error.stderr].filter(Boolean).join('\n'));
    }
  }
  if (failures.length)
    throw new Error(`有 ${failures.length} 份补验记录失败：\n${failures.join('\n\n')}`);
  if (!pending) console.log('没有待补验的原生应用。');
}

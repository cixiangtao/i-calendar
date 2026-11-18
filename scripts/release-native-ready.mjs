import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** 锁屏只影响窗口验证；本地发布可以记录待验，继续完成其他门禁。 */
export function nativeSessionStatus(platform, session) {
  assert.equal(platform, 'darwin', '本地版本准备需要 Mac 构建与真实窗口检查环境');
  if (!/"kCGSSessionOnConsoleKey"\s*=\s*Yes/.test(session))
    return { ready: false, reason: '未检测到可用的本机桌面会话' };
  if (/"CGSSessionScreenIsLocked"\s*=\s*Yes/.test(session))
    return { ready: false, reason: 'Mac 当前处于锁屏状态' };
  return { ready: true, reason: null };
}

export function readNativeSession() {
  assert.equal(process.platform, 'darwin', '本地版本准备需要 Mac 构建与真实窗口检查环境');
  const session = execFileSync('ioreg', ['-n', 'Root', '-d', '1', '-l'], { encoding: 'utf8' });
  return nativeSessionStatus(process.platform, session);
}

export function assertNativeSession(platform, session) {
  const status = nativeSessionStatus(platform, session);
  assert.ok(status.ready, status.reason);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const status = readNativeSession();
  if (!status.ready && !process.argv.includes('--defer-unavailable'))
    throw new Error(status.reason);
  console.log(
    status.ready
      ? 'PASS：Mac 桌面会话可用于原生窗口检查'
      : `待验：${status.reason}；继续构建，窗口检查将记录待验，不重复要求解锁。`,
  );
}

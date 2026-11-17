import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** 发布前确认真实窗口检查能运行，避免锁屏时先写入所有版本再失败。 */
export function assertNativeSession(platform, session) {
  assert.equal(platform, 'darwin', '本地版本准备需要 Mac 构建与真实窗口检查环境');
  assert.ok(/"kCGSSessionOnConsoleKey"\s*=\s*Yes/.test(session), '未检测到可用的本机桌面会话');
  assert.ok(
    !/"CGSSessionScreenIsLocked"\s*=\s*Yes/.test(session),
    'Mac 当前处于锁屏状态，请解锁后重新执行发布命令；本次尚未同步版本或推送标签',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.equal(process.platform, 'darwin', '本地版本准备需要 Mac 构建与真实窗口检查环境');
  const session = execFileSync('ioreg', ['-n', 'Root', '-d', '1', '-l'], { encoding: 'utf8' });
  assertNativeSession(process.platform, session);
  console.log('PASS：Mac 桌面会话可用于原生窗口检查');
}

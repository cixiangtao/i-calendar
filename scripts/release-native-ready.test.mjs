import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertNativeSession } from './release-native-ready.mjs';

test('版本写入前拒绝锁屏、非本机桌面和非 Mac 环境，不要求改变系统设置', () => {
  assert.doesNotThrow(() => assertNativeSession('darwin', '"kCGSSessionOnConsoleKey"=Yes'));
  assert.doesNotThrow(() =>
    assertNativeSession('darwin', '"kCGSSessionOnConsoleKey"=Yes,"CGSSessionScreenIsLocked"=No'),
  );
  assert.throws(
    () =>
      assertNativeSession('darwin', '"kCGSSessionOnConsoleKey"=Yes,"CGSSessionScreenIsLocked"=Yes'),
    /锁屏状态/,
  );
  assert.throws(() => assertNativeSession('darwin', '"kCGSSessionOnConsoleKey"=No'), /桌面会话/);
  assert.throws(() => assertNativeSession('linux', ''), /Mac/);
});

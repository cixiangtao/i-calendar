import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertNativeSession, nativeSessionStatus } from './release-native-ready.mjs';

test('严格窗口检查拒绝锁屏、非本机桌面和非 Mac 环境，不要求改变系统设置', () => {
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

test('本地发布可识别待验会话，但非 Mac 仍无法构建', () => {
  assert.deepEqual(nativeSessionStatus('darwin', '"kCGSSessionOnConsoleKey"=Yes'), {
    ready: true,
    reason: null,
  });
  assert.equal(
    nativeSessionStatus('darwin', '"kCGSSessionOnConsoleKey"=Yes,"CGSSessionScreenIsLocked"=Yes')
      .ready,
    false,
  );
  assert.equal(nativeSessionStatus('darwin', '').ready, false);
  assert.throws(() => nativeSessionStatus('linux', ''), /Mac/);
});

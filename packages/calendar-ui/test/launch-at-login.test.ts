import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LaunchAtLoginController } from '../src/launch-at-login.js';

test('启动项初次读取与重新进入均采用系统状态，不自动开启', async () => {
  let system = false;
  let writes = 0;
  const controller = new LaunchAtLoginController({
    get: async () => system,
    set: async (enabled) => {
      writes++;
      system = enabled;
      return system;
    },
  });
  assert.equal(controller.getSnapshot().enabled, null);
  await controller.refresh();
  assert.equal(controller.getSnapshot().enabled, false);
  assert.equal(writes, 0);
  await controller.set(true);
  assert.equal(controller.getSnapshot().enabled, true);
  assert.equal(writes, 1);
  system = false;
  await controller.refresh();
  assert.equal(controller.getSnapshot().enabled, false);
});

test('读写互斥，等待系统结果后才切换；不能在读取之前盲目写入', async () => {
  let complete!: (value: boolean) => void;
  let writes = 0;
  const controller = new LaunchAtLoginController({
    get: async () => false,
    set: () => {
      writes++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  await controller.set(true);
  assert.equal(writes, 0);
  await controller.refresh();
  const changing = controller.set(true);
  await controller.set(false);
  await controller.refresh();
  assert.equal(writes, 1);
  assert.equal(controller.getSnapshot().enabled, false);
  assert.equal(controller.getSnapshot().phase, 'updating');
  complete(true);
  await changing;
  assert.equal(controller.getSnapshot().enabled, true);
});

test('系统拒绝更改时读回真实状态，不显示虚假的成功', async () => {
  const controller = new LaunchAtLoginController({
    get: async () => false,
    set: async () => {
      throw new Error('permission denied');
    },
  });
  await controller.refresh();
  await controller.set(true);
  assert.equal(controller.getSnapshot().enabled, false);
  assert.ok(controller.getSnapshot().error);
  const unapplied = new LaunchAtLoginController({ get: async () => false, set: async () => false });
  await unapplied.refresh();
  await unapplied.set(true);
  assert.equal(unapplied.getSnapshot().enabled, false);
  assert.ok(unapplied.getSnapshot().error);
});

test('读取失败保留未知状态，读取恢复后可继续设置', async () => {
  let offline = true;
  const controller = new LaunchAtLoginController({
    get: async () => {
      if (offline) throw new Error('read error');
      return true;
    },
    set: async () => {
      throw new Error('write error');
    },
  });
  await controller.refresh();
  assert.equal(controller.getSnapshot().enabled, null);
  assert.ok(controller.getSnapshot().error);
  offline = false;
  await controller.refresh();
  assert.equal(controller.getSnapshot().enabled, true);
  offline = true;
  await controller.set(false);
  assert.equal(controller.getSnapshot().enabled, null);
});

test('不支持的平台与已销毁的控制器不操作系统启动项', async () => {
  const unavailable = new LaunchAtLoginController(undefined);
  await unavailable.refresh();
  await unavailable.set(true);
  assert.equal(unavailable.getSnapshot().phase, 'unavailable');
  let reads = 0;
  const controller = new LaunchAtLoginController({
    get: async () => {
      reads++;
      return false;
    },
    set: async (enabled) => enabled,
  });
  controller.dispose();
  await controller.refresh();
  await controller.set(true);
  assert.equal(reads, 0);
});

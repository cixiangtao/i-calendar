import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppUpdateController, type AppRelease, type AppUpdater } from '../src/app-update.js';
import { CalendarController, parseSavedState } from '../src/store.js';

const release: AppRelease = { version: '1.0.1', notes: '修复跨日刷新' };

test('自动检查只提示、不安装，每日限频，手动检查可重试', async () => {
  let now = new Date('2026-11-13T04:00:00Z');
  let checks = 0;
  let installs = 0;
  const controller = new AppUpdateController(
    {
      check: async () => {
        checks++;
        return release;
      },
      install: async () => {
        installs++;
      },
    },
    () => now,
  );
  await controller.check(true);
  await controller.check(true);
  assert.equal(checks, 1);
  assert.equal(installs, 0);
  assert.equal(controller.getSnapshot().phase, 'available');
  await controller.check();
  assert.equal(checks, 2);
  now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await controller.check(true);
  assert.equal(checks, 3);
});

test('稍后处理保留关于页更新，同版本不重复提醒，新版本重新提醒', async () => {
  let next = release;
  const controller = new AppUpdateController({ check: async () => next, install: async () => {} });
  await controller.check();
  controller.defer();
  await controller.check();
  assert.equal(controller.getSnapshot().release?.version, '1.0.1');
  assert.equal(controller.getSnapshot().dismissed, true);
  next = { version: '1.0.2' };
  await controller.check();
  assert.equal(controller.getSnapshot().dismissed, false);
});

test('检查、下载和安装互斥，失败后可重试且不改变日历数据', async () => {
  let completeCheck!: (value: AppRelease) => void;
  let completeInstall!: () => void;
  let checks = 0;
  let installs = 0;
  const updater: AppUpdater = {
    check: () => {
      checks++;
      return new Promise((resolve) => {
        completeCheck = resolve;
      });
    },
    install: async (version, progress) => {
      assert.equal(version, '1.0.1');
      installs++;
      progress({ phase: 'downloading', downloaded: 20, total: 100 });
      if (installs === 1) throw new Error('signature mismatch');
      await new Promise<void>((resolve) => {
        completeInstall = resolve;
      });
      progress({ phase: 'installing', downloaded: 100, total: 100 });
    },
  };
  const controller = new AppUpdateController(updater);
  const checking = controller.check();
  await controller.check();
  await controller.install();
  assert.equal(checks, 1);
  assert.equal(installs, 0);
  completeCheck(release);
  await checking;
  await controller.install();
  assert.equal(controller.getSnapshot().phase, 'error');
  assert.ok(controller.getSnapshot().error);
  const installing = controller.install();
  await Promise.resolve();
  assert.equal(controller.getSnapshot().progress?.downloaded, 20);
  await controller.install();
  await controller.check();
  assert.equal(installs, 2);
  assert.equal(checks, 1);
  completeInstall();
  await installing;
  assert.equal(controller.getSnapshot().phase, 'installing');
});

test('离线自动检查不反复请求，未配置与销毁后的控制器不执行更新', async () => {
  const unavailable = new AppUpdateController(undefined);
  await unavailable.check();
  await unavailable.install();
  assert.equal(unavailable.getSnapshot().phase, 'unavailable');
  let checks = 0;
  const controller = new AppUpdateController({
    check: async () => {
      checks++;
      throw new Error('offline');
    },
    install: async () => {},
  });
  await controller.check(true);
  await controller.check(true);
  assert.equal(checks, 1);
  assert.equal(controller.getSnapshot().phase, 'error');
  controller.dispose();
  await controller.check();
  assert.equal(checks, 1);
});

test('下载完成后再次保存偏好，期间保存失败不进入安装', async () => {
  let preparations = 0;
  let applied = false;
  const controller = new AppUpdateController(
    {
      check: async () => release,
      install: async (_version, progress, beforeInstall) => {
        progress({ phase: 'downloading', downloaded: 100, total: 100 });
        await beforeInstall();
        applied = true;
      },
    },
    () => new Date(),
    async () => {
      preparations++;
      if (preparations === 2) throw new Error('下载期间最新设置写入失败');
    },
  );
  await controller.check();
  await controller.install();
  assert.equal(preparations, 2);
  assert.equal(applied, false);
  assert.equal(controller.getSnapshot().phase, 'error');
});

test('应用更新偏好兼容旧状态，关闭后可恢复，非法值拒绝载入', async () => {
  const legacy = {
    schemaVersion: 1,
    preferences: { weekStartsOn: 1, appearance: 'system' },
    datasets: [],
  };
  assert.equal(parseSavedState(legacy).preferences.automaticAppUpdates, true);
  assert.equal(
    parseSavedState({
      ...legacy,
      preferences: { ...legacy.preferences, automaticAppUpdates: false },
    }).preferences.automaticAppUpdates,
    false,
  );
  for (const value of [null, 0, 'false', {}])
    assert.throws(() =>
      parseSavedState({
        ...legacy,
        preferences: { ...legacy.preferences, automaticAppUpdates: value },
      }),
    );
});

test('安装前等待偏好写入，写入失败阻止重启，可在保存恢复后重试', async () => {
  let finishSave!: () => void;
  let installs = 0;
  const controller = new CalendarController({
    kind: 'macos',
    load: async () => null,
    save: async () => {
      await new Promise<void>((resolve) => {
        finishSave = resolve;
      });
    },
    fetchHolidayYear: async () => null,
    copyText: async () => {},
    openExternal: async () => {},
    appUpdater: {
      check: async () => release,
      install: async () => {
        installs++;
      },
    },
  });
  await controller.initialize();
  await controller.appUpdates.check();
  const saving = controller.setPreferences({ automaticAppUpdates: false });
  const installing = controller.appUpdates.install();
  await Promise.resolve();
  assert.equal(installs, 0);
  finishSave();
  await saving;
  await installing;
  assert.equal(installs, 1);
  controller.dispose();

  const failed = new CalendarController({
    kind: 'macos',
    load: async () => null,
    save: async () => {
      throw new Error('disk full');
    },
    fetchHolidayYear: async () => null,
    copyText: async () => {},
    openExternal: async () => {},
    appUpdater: {
      check: async () => release,
      install: async () => {
        installs++;
      },
    },
  });
  await failed.initialize();
  await failed.appUpdates.check();
  await failed.setPreferences({ automaticAppUpdates: false });
  await failed.appUpdates.install();
  assert.equal(installs, 1);
  assert.equal(failed.appUpdates.getSnapshot().phase, 'error');
  failed.dispose();
});

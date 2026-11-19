import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { Plugin } from 'release-it';

import { planRelease } from './release-plan.mjs';

/** 根清单提供版本；所有写入通过 release-it Shell，确保 dry-run 不执行。 */
export default class CalendarVersion extends Plugin {
  async getLatestVersion() {
    return JSON.parse(await readFile('package.json', 'utf8')).version;
  }

  async getIncrement({ latestVersion, increment, isPreRelease }) {
    assert.ok(!isPreRelease, '应用发布只支持正式版本');
    const plan = await planRelease(process.cwd(), latestVersion);
    if (!plan.level) throw new Error('自上次正式发布以来没有需要递增应用版本的提交');
    this.log.log(`应用版本建议：${plan.current} → ${plan.version}（${plan.level}）`);
    for (const { hash, subject, level } of plan.commits)
      this.log.log(`  ${level} ${hash} ${subject}`);
    assert.ok(
      !increment || increment === plan.level || increment === plan.version,
      `指定的版本与提交推导结果 ${plan.version} 不一致`,
    );
    return plan.version;
  }

  bump() {
    return this.exec('node scripts/release-version.mjs sync ${version}');
  }
}

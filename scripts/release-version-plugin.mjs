import { readFile } from 'node:fs/promises';

import { Plugin } from 'release-it';

/** 根清单提供版本；所有写入通过 release-it Shell，确保 dry-run 不执行。 */
export default class CalendarVersion extends Plugin {
  async getLatestVersion() {
    return JSON.parse(await readFile('package.json', 'utf8')).version;
  }

  bump() {
    return this.exec('node scripts/release-version.mjs sync ${version}');
  }
}

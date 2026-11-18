import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { checkNativeApp, resumeNativeChecks } from './native-app-check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const native = path.join(root, 'apps/calendar/src-tauri');
try {
  const deferUnavailable = process.argv.includes('--defer-unavailable');
  if (process.argv.includes('--resume')) {
    await resumeNativeChecks({ root, deferUnavailable: true });
  } else {
    const { stdout, stderr } = await run('cargo', ['test', '--locked', '--lib', '--examples'], {
      cwd: native,
      maxBuffer: 2_000_000,
    });
    console.log(stdout);
    if (stderr) console.log(stderr);
    if (process.argv.includes('--app')) {
      const index = process.argv.indexOf('--app-path');
      const app = index < 0 ? 'outputs/mac/i日历.app' : process.argv[index + 1];
      if (!app || app.startsWith('--')) throw new Error('--app-path 需要应用路径');
      await checkNativeApp({
        root,
        executable: path.join(app, 'Contents/MacOS/i-calendar'),
        deferUnavailable,
      });
    }
  }
} catch (error) {
  console.error(error.stdout ?? '', error.stderr ?? '', error.message);
  process.exitCode = 1;
}

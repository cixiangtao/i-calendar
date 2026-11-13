import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const native = path.join(root, 'apps/calendar/src-tauri');
try {
  const { stdout, stderr } = await run('cargo', ['test', '--locked', '--lib', '--examples'], {
    cwd: native,
    maxBuffer: 2_000_000,
  });
  console.log(stdout);
  if (stderr) console.log(stderr);
  if (process.argv.includes('--app')) {
    const app = path.join(root, 'outputs/mac/i日历.app/Contents/MacOS/i-calendar');
    for (const args of [['--smoke-test'], ['--smoke-test', '--autostart']]) {
      const result = await run(app, args, {
        cwd: root,
        timeout: 40_000,
        maxBuffer: 1_000_000,
      });
      if (!result.stdout.includes('PASS：Tauri'))
        throw new Error('原生应用未返回前端验证结果，请重新构建应用后重试。');
      if (args.includes('--autostart') && !result.stdout.includes('PASS：开机自启模式'))
        throw new Error('原生应用未通过后台启动验证。');
      console.log(result.stdout.trim());
    }
  }
} catch (error) {
  console.error(error.stdout ?? '', error.stderr ?? '', error.message);
  process.exitCode = 1;
}

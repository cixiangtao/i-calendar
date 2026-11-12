import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const native = path.join(root, 'apps/calendar/src-tauri');
try {
  const { stdout, stderr } = await run('cargo', ['test', '--locked', '--lib'], { cwd: native, maxBuffer: 2_000_000 });
  console.log(stdout); if (stderr) console.log(stderr);
  if (process.argv.includes('--app')) {
    const app = path.join(root, 'outputs/mac/拾日历.app/Contents/MacOS/shiri-calendar');
    const result = await run(app, ['--smoke-test'], { cwd: root, timeout: 40_000, maxBuffer: 1_000_000 });
    if (!result.stdout.includes('PASS：Tauri')) throw new Error('原生应用未返回前端验证结果。请先退出正在运行的拾日历，再执行验证。');
    console.log(result.stdout.trim());
  }
} catch (error) {
  console.error(error.stdout ?? '', error.stderr ?? '', error.message);
  process.exitCode = 1;
}

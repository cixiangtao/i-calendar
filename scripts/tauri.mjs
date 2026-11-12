import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args[0] === 'ios') {
  try {
    execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { stdio: 'ignore' });
  } catch {
    console.error(
      'iOS 开发需要完整 Xcode 和 iOS SDK。安装后在 Xcode → Settings 中选择开发团队，再运行 pnpm run ios:init。当前仅有 Command Line Tools 时无法编译或验证 iOS 应用。',
    );
    process.exit(1);
  }
}
const child = spawn(
  process.execPath,
  [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'), ...args],
  {
    cwd: path.join(root, 'apps/calendar'),
    stdio: 'inherit',
    env: process.env,
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  console.error('无法启动 Tauri：', error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const project = fileURLToPath(new URL('../packages/calendar-core/', import.meta.url));
await rm(new URL('../packages/calendar-core/dist/', import.meta.url), {
  recursive: true,
  force: true,
});
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
    '-p',
    fileURLToPath(new URL('../packages/calendar-core/tsconfig.json', import.meta.url)),
  ],
  { stdio: 'inherit' },
);
await build({
  absWorkingDir: project,
  entryPoints: ['src/index.ts', 'src/data.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['lunar-typescript'],
  sourcemap: true,
});

import { build } from 'esbuild';
await build({
  entryPoints: ['src/index.ts', 'src/data.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['lunar-typescript'],
  sourcemap: true,
});

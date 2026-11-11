import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
// iOS and macOS use this exact bundle through JavaScriptCore. No browser or Node globals.
await build({
  entryPoints: ['packages/calendar-core/src/apple-entry.ts'],
  outfile: 'dist/apple/calendar-core.js',
  bundle: true,
  format: 'iife',
  globalName: 'ShiriCalendar',
  platform: 'neutral',
  target: 'es2020',
  minify: true,
  legalComments: 'eof',
});
await mkdir('platforms/apple/Sources/ShiriCalendarKit/Resources', { recursive: true });
await copyFile('dist/apple/calendar-core.js', 'platforms/apple/Sources/ShiriCalendarKit/Resources/calendar-core.js');

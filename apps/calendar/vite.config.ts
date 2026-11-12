import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const nativeHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: source('.'),
  base: process.env.I_CALENDAR_BASE ?? './',
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss({ config: source('../../tailwind.config.ts') }), autoprefixer()],
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@i-calendar/core/data',
        replacement: source('../../packages/calendar-core/src/data.ts'),
      },
      {
        find: '@i-calendar/core',
        replacement: source('../../packages/calendar-core/src/index.ts'),
      },
      {
        find: '@i-calendar/ui',
        replacement: source('../../packages/calendar-ui/src/index.ts'),
      },
    ],
  },
  server: {
    port: 1420,
    strictPort: true,
    host: nativeHost ?? '127.0.0.1',
    hmr: nativeHost ? { protocol: 'ws', host: nativeHost, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'safari16',
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'lunar', test: /node_modules\/lunar-typescript/ },
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'controls', test: /node_modules\/(antd|@ant-design|@rc-component|rc-)/ },
          ],
        },
      },
    },
  },
});

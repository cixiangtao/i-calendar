import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';

import { calendarThemeDefaults } from '../../scripts/theme-css.js';
import calendarTailwind from '../../tailwind.config.ts';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const nativeHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: source('.'),
  base: process.env.I_CALENDAR_BASE ?? './',
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        calendarThemeDefaults(),
        // 静态导入让 Vite 跟踪配置变更并重启，避免长驻开发服务沿用旧的主题与变体。
        // 使用绝对内容路径，保证从仓库根目录或 Tauri 应用目录启动时扫描结果相同。
        tailwindcss({
          ...calendarTailwind,
          content: {
            ...calendarTailwind.content,
            files: calendarTailwind.content.files.map((file) => source(`../../${file}`)),
          },
        }),
        autoprefixer(),
      ],
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
            { name: 'controls', test: /node_modules\/@radix-ui\// },
          ],
        },
      },
    },
  },
});

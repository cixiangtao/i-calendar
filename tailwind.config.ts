import type { Config } from 'tailwindcss';

export default {
  content: {
    relative: true,
    files: ['./apps/calendar/index.html', './apps/calendar/src/**/*.{ts,tsx}', './packages/calendar-ui/src/**/*.{ts,tsx}'],
  },
  prefix: 'tw-',
  // 保留既有基础样式和 Ant Design 控件的默认行为。
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: { accent: 'var(--accent)', surface: 'var(--surface)', ink: 'var(--ink)' },
      spacing: { control: '5px' },
    },
  },
} satisfies Config;

import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

export default {
  content: {
    relative: true,
    files: [
      './apps/calendar/index.html',
      './apps/calendar/src/**/*.{ts,tsx}',
      './packages/calendar-ui/src/**/*.{ts,tsx}',
    ],
  },
  prefix: 'tw-',
  // 保留既有页面基线和原生控件默认语义，避免迁移时引入全局重置。
  corePlugins: { preflight: false },
  plugins: [
    plugin(({ addVariant, addUtilities }) => {
      addVariant('app', '[class~="calendar-app"] &');
      addUtilities({ '.overflow-anywhere': { overflowWrap: 'anywhere' } });
      addVariant('mac', "body[data-platform='macos'] &");
      addVariant('ios', "body[data-platform='ios'] &");
      addVariant('web', "body[data-platform='web'] &");
    }),
  ],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        secondary: 'var(--secondary)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        control: 'var(--control)',
        'control-hover': 'var(--control-hover)',
        'control-active': 'var(--control-active)',
        action: 'var(--blue)',
        'action-soft': 'var(--blue-soft)',
        red: 'var(--red)',
        yellow: 'var(--yellow)',
        green: 'var(--green)',
        'green-soft': 'var(--green-soft)',
        'red-soft': 'var(--red-soft)',
        leaf: 'var(--leaf)',
        'leaf-hover': 'var(--leaf-hover)',
        'leaf-active': 'var(--leaf-active)',
        'switch-off': 'var(--switch-off)',
        'switch-off-hover': 'var(--switch-off-hover)',
        'switch-off-active': 'var(--switch-off-active)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      screens: {
        desktop: '860px',
        compact: { max: '430px' },
        tiny: { max: '350px' },
        coarse: { raw: '(pointer: coarse)' },
        fine: { raw: '(hover: hover)' },
        short: { raw: '(max-height: 700px)' },
      },
      spacing: { control: '5px' },
    },
  },
} satisfies Config;

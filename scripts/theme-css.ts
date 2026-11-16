import { atRule, decl, rule, type Plugin } from 'postcss';

import { deriveColorTokens } from '../packages/calendar-ui/src/color-theme.js';
import { builtInThemes } from '../packages/calendar-ui/src/theme-package.js';

function createDefaultRule(dark: boolean, high: boolean) {
  const node = rule({ selector: dark ? ":root[data-theme='dark']" : ':root' });
  const colors = deriveColorTokens(builtInThemes[0].palettes[dark ? 'dark' : 'light'], high);
  for (const [prop, value] of Object.entries(colors)) node.append(decl({ prop, value }));
  return node;
}

/** 构建首帧 CSS 时复用运行时派生器，避免维护第二份手写的派生色。 */
export function calendarThemeDefaults(): Plugin {
  return {
    postcssPlugin: 'calendar-theme-defaults',
    AtRule: {
      'calendar-theme-defaults': (placeholder) => {
        const contrast = atRule({ name: 'media', params: '(prefers-contrast: more)' });
        contrast.append(createDefaultRule(false, true), createDefaultRule(true, true));
        const nodes = [createDefaultRule(false, false), createDefaultRule(true, false), contrast];
        for (const node of nodes) {
          node.source = placeholder.source;
          node.walk((child) => {
            child.source = placeholder.source;
          });
        }
        placeholder.replaceWith(...nodes);
      },
    },
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import postcss from 'postcss';

import { calendarThemeDefaults } from '../../../scripts/theme-css.js';
import { deriveColorTokens } from '../src/color-theme.js';
import { builtInThemes, parseThemePackage } from '../src/theme-package.js';

test('内置主题与外部主题包共享八主色契约，JSON 往返产生相同渲染结果', () => {
  for (const theme of builtInThemes) {
    const imported = parseThemePackage(JSON.parse(JSON.stringify(theme)));
    assert.equal(imported.schemaVersion, 1);
    assert.equal(imported.rulesVersion, 1);
    for (const appearance of ['light', 'dark'] as const) {
      assert.equal(Object.keys(imported.palettes[appearance]).length, 8);
      assert.deepEqual(
        deriveColorTokens(imported.palettes[appearance]),
        deriveColorTokens(theme.palettes[appearance]),
      );
    }
    imported.palettes.light.ink = '#abcdef';
    assert.notEqual(imported.palettes.light.ink, theme.palettes.light.ink);
  }
});

test('主题包拒绝未知版本、派生色、非法颜色与附带代码，不接受缺失的主色', () => {
  const theme = structuredClone(builtInThemes[0]);
  for (const input of [
    null,
    [],
    { ...theme, schemaVersion: 2 },
    { ...theme, rulesVersion: 2 },
    { ...theme, id: '../unsafe' },
    { ...theme, name: '' },
    { ...theme, version: 'latest' },
    { ...theme, script: 'alert(1)' },
    { ...theme, palettes: { ...theme.palettes, other: {} } },
    {
      ...theme,
      palettes: { ...theme.palettes, light: { ...theme.palettes.light, secondary: '#000000' } },
    },
    { ...theme, palettes: { ...theme.palettes, light: { ...theme.palettes.light, ink: 'red' } } },
    { ...theme, palettes: { light: theme.palettes.light } },
  ])
    assert.throws(() => parseThemePackage(input));
});

test('首帧浅深色及高对比 CSS 使用相同派生规则，不维护独立色表', async () => {
  const result = await postcss([calendarThemeDefaults()]).process('@calendar-theme-defaults;', {
    from: undefined,
  });
  assert.doesNotMatch(result.css, /@calendar-theme-defaults/);
  let checked = 0;
  result.root.walkRules((rule) => {
    assert.ok(rule.source);
    const dark = rule.selector.includes('dark');
    const high = rule.parent?.type === 'atrule';
    const expected = deriveColorTokens(builtInThemes[0].palettes[dark ? 'dark' : 'light'], high);
    const values: Record<string, string> = {};
    rule.walkDecls((decl) => {
      assert.ok(decl.source);
      values[decl.prop] = decl.value;
    });
    assert.deepEqual(values, expected);
    checked++;
  });
  assert.equal(checked, 4);
});

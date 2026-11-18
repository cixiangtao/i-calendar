import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import postcss from 'postcss';

import { calendarThemeDefaults } from '../../../scripts/theme-css.js';
import { contrastRatio, deriveColorTokens, resolveThemeTokens } from '../src/color-theme.js';
import { formatThemeColor, normalizeThemeColor, parseThemeColor } from '../src/theme-color.js';
import { activeTheme, migrateThemeLibrary } from '../src/theme-library.js';
import { builtInThemes, parseThemePackage } from '../src/theme-package.js';

test('新装默认沿用清爽白的浅深配色，主题本身不含背景图', () => {
  const theme = activeTheme(migrateThemeLibrary({}));
  assert.equal(theme.id, 'clear');
  assert.equal(theme.background, undefined);
  assert.equal(theme.palettes.light.canvas, '#f1f2f6');
  assert.equal(theme.palettes.light.surface, '#ffffff');
  assert.equal(theme.palettes.dark.canvas, '#171b23');
  assert.equal(theme.palettes.dark.surface, '#222630');
  assert.equal(theme.palettes.light.accent, '#3269d9');
  assert.equal(theme.palettes.dark.accent, '#3269d9');
});

test('内置主题与外部主题包共享八主色契约，JSON 往返产生相同渲染结果', () => {
  for (const theme of builtInThemes) {
    const imported = parseThemePackage(JSON.parse(JSON.stringify(theme)));
    assert.equal(imported.schemaVersion, theme.schemaVersion);
    assert.equal(imported.rulesVersion, theme.rulesVersion);
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

test('多种颜色格式归一化并保留 Alpha，派生文字以实际实色背景计算', () => {
  for (const value of [
    '#abc8',
    'rgb(170 187 204 / 53.333333%)',
    'hsla(210, 25%, 73.333333%, .53333333)',
  ])
    assert.equal(normalizeThemeColor(value, true), 'rgba(170, 187, 204, 0.533333)');
  const opaque = parseThemeColor('#6e812c')!;
  assert.deepEqual(parseThemeColor(formatThemeColor(opaque, 'hsl')), opaque);
  assert.equal(normalizeThemeColor('rgba(170, 187, 204, .5)', false), null);
  for (const invalid of [
    '#aabbc',
    'rgb(256, 0, 0)',
    'hsla(90, 101%, 50%, .5)',
    'rgb(1 2 3 / )',
    'var(--ink)',
    'url(https://example.org)',
  ])
    assert.equal(parseThemeColor(invalid), null);

  const theme = parseThemePackage({
    ...builtInThemes[3],
    palettes: {
      light: {
        ...builtInThemes[3].palettes.light,
        canvas: '#000',
        surface: 'rgba(255,255,255,.9)',
      },
      dark: { ...builtInThemes[3].palettes.dark, canvas: '#0000', surface: 'rgba(0,0,0,.5)' },
    },
  });
  const light = resolveThemeTokens(theme, false);
  const dark = resolveThemeTokens(theme, true);
  assert.equal(light['--surface'], '#e6e6e6');
  assert.equal(dark['--canvas'], '#171b23');
  assert.equal(dark['--surface'], '#0c0e12');
  for (const tokens of [light, dark])
    assert.ok(contrastRatio(tokens['--lunar-ink'], tokens['--surface']) >= 4.5);
});

test('带图主题包往返保留图片与裁切，拒绝外链、无效图像和越界参数', async () => {
  const image = await readFile(
    new URL('../src/assets/theme-mountain.jpg', import.meta.url),
    'base64',
  );
  const theme = {
    ...builtInThemes[3],
    background: { image, strength: 65, x: 37, y: 70 },
  };
  assert.deepEqual(parseThemePackage(JSON.parse(JSON.stringify(theme))), theme);
  for (const background of [
    { ...theme.background, image: 'https://example.org/a.jpg' },
    { ...theme.background, image: 'data:image/jpeg;base64,' + image },
    { ...theme.background, image: btoa('hello world') },
    { ...theme.background, x: 101 },
    { ...theme.background, y: 4.2 },
    { ...theme.background, strength: -1 },
  ]) {
    assert.throws(() => parseThemePackage({ ...theme, background }), /背景图或裁切参数无效/);
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

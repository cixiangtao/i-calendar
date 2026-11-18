import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  colorThemes,
  colorContrastIssues,
  colorTokenGroups,
  primaryColorGroups,
  contrastRatio,
  isAccentColor,
  parseCustomColors,
  resolveColorTheme,
} from '../src/color-theme.js';
import { parseSavedState } from '../src/store.js';
import { builtInThemes } from '../src/theme-package.js';

test('旧设置补齐主题默认值，新设置与无效自定义配色有明确边界', () => {
  const legacy = {
    schemaVersion: 1,
    preferences: { weekStartsOn: 1, appearance: 'system' },
    datasets: [],
  };
  const restored = parseSavedState(legacy);
  assert.deepEqual(restored.preferences.themes, { selectedId: 'clear', custom: [] });
  assert.equal(isAccentColor('#Aa12fF'), true);
  for (const value of ['red', '#abc', '#12345678', 'var(--ink)', '', 123])
    assert.equal(isAccentColor(value), false);
  for (const preferences of [{ colorTheme: 'unknown' }, { accentColor: 'red' }])
    assert.throws(() =>
      parseSavedState({ ...legacy, preferences: { ...legacy.preferences, ...preferences } }),
    );
});

test('高级配色仅接受受支持的颜色角色，旧偏好默认关闭且解析结果不共享可变对象', () => {
  const first = parseCustomColors(undefined);
  const second = parseCustomColors(undefined);
  first.light['--surface'] = '#123456';
  assert.deepEqual(second, { enabled: false, light: {}, dark: {} });
  const source = { enabled: true, light: { '--ink': '#Aa12fF' }, dark: {} };
  const parsed = parseCustomColors(source);
  assert.equal(parsed.light['--ink'], '#aa12ff');
  source.light['--ink'] = '#000000';
  assert.equal(parsed.light['--ink'], '#aa12ff');
  for (const input of [
    null,
    [],
    {},
    { ...second, enabled: 'true' },
    { ...second, light: null },
    { ...second, light: { '--ink': 'url(https://example.com)' } },
    { ...second, light: { '--ink': '#abc' } },
    { ...second, dark: { '--unsupported': '#000000' } },
    { ...second, background: '#000000' },
    JSON.parse('{"enabled":true,"light":{"__proto__":"#000000"},"dark":{}}'),
  ])
    assert.throws(() => parseCustomColors(input), /高级配色设置无效/);
});

test('只编辑八个主色，派生色随主色更新，浅深色隔离且停用后恢复基础主题', () => {
  const preferences = { colorTheme: 'clear' as const, accentColor: null };
  const baseline = resolveColorTheme(preferences, false).tokens;
  const keys = primaryColorGroups.flatMap((group) => group.items.map((item) => item.key));
  assert.equal(keys.length, 8);
  assert.equal(new Set(keys).size, 8);
  assert.deepEqual(
    new Set(colorTokenGroups.flatMap((group) => group.items.map((item) => item.key))),
    new Set(Object.keys(baseline)),
  );
  const custom = parseCustomColors({
    enabled: true,
    light: {
      '--canvas': '#f8eade',
      '--surface': '#fff6ee',
      '--ink': '#5d283f',
      '--blue': '#8948a3',
      '--red': '#a33545',
    },
    dark: { '--surface': '#18262a', '--ink': '#d9ece8', '--blue': '#4fba96' },
  });
  const light = resolveColorTheme({ ...preferences, customColors: custom }, false).tokens;
  const dark = resolveColorTheme({ ...preferences, customColors: custom }, true).tokens;
  assert.equal(light['--surface'], '#fff6ee');
  assert.equal(dark['--surface'], '#18262a');
  for (const token of [
    '--control',
    '--control-hover',
    '--control-active',
    '--line',
    '--secondary',
    '--lunar-ink',
    '--outside-ink',
    '--blue-soft',
    '--leaf',
    '--red-soft',
    '--outside-red',
  ] as const)
    assert.notEqual(light[token], baseline[token], token);
  assert.notEqual(light['--control'], light['--control-hover']);
  assert.notEqual(light['--control-hover'], light['--control-active']);
  assert.deepEqual(colorContrastIssues(light), []);
  assert.deepEqual(colorContrastIssues(dark), []);
  assert.deepEqual(
    resolveColorTheme({ ...preferences, customColors: { ...custom, enabled: false } }, false)
      .tokens,
    baseline,
  );
});

test('旧版完整配色保留主色，派生色不再覆盖生成结果或写入新设置', () => {
  const restored = parseCustomColors({
    enabled: true,
    light: {
      '--ink': '#453833',
      '--red': '#b52d44',
      '--control-hover': '#abcdef',
      '--secondary': '#123456',
      '--leaf-ink': '#000000',
    },
    dark: { '--surface': '#18262a', '--outside-red': '#998877' },
  });
  assert.deepEqual(restored, {
    enabled: true,
    light: { '--ink': '#453833', '--red': '#b52d44' },
    dark: { '--surface': '#18262a' },
  });
  const tokens = resolveColorTheme(
    { colorTheme: 'clear', accentColor: null, customColors: restored },
    false,
  ).tokens;
  assert.notEqual(tokens['--control-hover'], '#abcdef');
  assert.notEqual(tokens['--secondary'], '#123456');
  assert.equal(tokens['--leaf-ink'], '#ffffff');
  assert.throws(
    () => parseCustomColors({ ...restored, light: { '--secondary': 'var(--ink)' } }),
    /高级配色设置无效/,
  );
});

test('主色原值保留，生成器修正不可读文字并提示无法同时满足的背景对比', () => {
  const customColors = parseCustomColors({
    enabled: true,
    light: { '--ink': '#ffffff', '--surface': '#ffffff', '--canvas': '#000000' },
    dark: {},
  });
  const normal = resolveColorTheme(
    { colorTheme: 'clear', accentColor: null, customColors },
    false,
  ).tokens;
  assert.ok(contrastRatio(normal['--ink'], normal['--surface']) >= 4.5);
  assert.notEqual(normal['--ink'], '#ffffff');
  assert.equal(customColors.light['--ink'], '#ffffff');
  const high = resolveColorTheme(
    { colorTheme: 'clear', accentColor: null, customColors },
    false,
    true,
  ).tokens;
  const issue = colorContrastIssues(high, true).find((item) => item.token === '--hint-ink');
  assert.ok(issue && issue.minimum === 7 && issue.ratio < 7);
});

test('基础主题的配色预览没有低对比度误报', () => {
  for (const preset of colorThemes)
    for (const dark of [false, true])
      for (const increasedContrast of [false, true])
        assert.deepEqual(
          colorContrastIssues(
            resolveColorTheme({ colorTheme: preset.id, accentColor: null }, dark, increasedContrast)
              .tokens,
            increasedContrast,
          ),
          [],
          `${preset.id}/${dark}/${increasedContrast}`,
        );
});

test('预设与极端强调色在明暗模式均满足文字对比，原始选色保持不变', () => {
  for (const preset of colorThemes)
    for (const dark of [false, true])
      for (const accentColor of [
        null,
        '#ffffff',
        '#000000',
        '#ffff00',
        '#0000ff',
        '#ff0000',
        '#00ff00',
        '#808080',
      ]) {
        const preferences = { colorTheme: preset.id, accentColor };
        const result = resolveColorTheme(preferences, dark);
        const t = result.tokens;
        const original = builtInThemes.find((theme) => theme.id === preset.id)!;
        assert.equal(
          result.accent,
          accentColor ?? original.palettes[dark ? 'dark' : 'light'].accent,
        );
        for (const fg of [
          '--ink',
          '--secondary',
          '--muted',
          '--lunar-ink',
          '--weekday-ink',
          '--hint-ink',
        ] as const)
          assert.ok(contrastRatio(t[fg], t['--surface']) >= 4.5, `${preset.id}/${dark}/${fg}`);
        for (const bg of [
          '--surface',
          '--blue-soft',
          '--control',
          '--hover',
          '--control-hover',
          '--control-active',
        ] as const)
          assert.ok(
            contrastRatio(t['--blue'], t[bg]) >= 4.5,
            `${preset.id}/${dark}/${accentColor}/${bg}`,
          );
        assert.ok(contrastRatio('#ffffff', t['--leaf']) >= 4.5);
        assert.ok(contrastRatio('#ffffff', t['--leaf-hover']) >= 4.5);
        assert.ok(contrastRatio('#ffffff', t['--leaf-active']) >= 4.5);
        for (const bg of ['--switch-off', '--switch-off-hover', '--switch-off-active'] as const)
          assert.ok(contrastRatio('#ffffff', t[bg]) >= 4.5, `${preset.id}/${dark}/${bg}`);
        for (const bg of ['--control', '--control-hover', '--control-active'] as const)
          for (const fg of ['--ink', '--secondary'] as const)
            assert.ok(contrastRatio(t[fg], t[bg]) >= 4.5, `${preset.id}/${dark}/${fg}/${bg}`);
        assert.notEqual(t['--control'], t['--control-hover']);
        assert.notEqual(t['--control-hover'], t['--control-active']);
        assert.notEqual(t['--selected-bg'], t['--surface']);
        assert.notEqual(t['--selected-bg'], t['--control']);
        for (const fg of ['--blue', '--selected-ink', '--green', '--purple'] as const)
          assert.ok(contrastRatio(t[fg], t['--selected-bg']) >= 4.5);
        assert.notEqual(t['--outside-ink'], t['--lunar-ink']);
        assert.ok(
          contrastRatio(t['--outside-ink'], t['--surface']) <
            contrastRatio(t['--lunar-ink'], t['--surface']),
        );
        for (const background of ['--surface', '--control', '--red-soft'] as const)
          assert.ok(contrastRatio(t['--outside-ink'], t[background]) >= 2.2);
        for (const foreground of ['--muted', '--lunar-ink'] as const)
          for (const background of ['--control', '--red-soft'] as const)
            assert.ok(contrastRatio(t[foreground], t[background]) >= 4.5);

        for (const role of ['red', 'green', 'yellow', 'purple'] as const)
          for (const foreground of [`--${role}`, `--outside-${role}`] as const)
            for (const background of [
              '--surface',
              '--control',
              '--blue-soft',
              `--${role}-soft`,
            ] as const)
              assert.ok(
                contrastRatio(t[foreground], t[background]) >=
                  (foreground.startsWith('--outside-') ? 2.2 : 4.5),
                `${preset.id}/${dark}/${accentColor}/${foreground}/${background}`,
              );
        const high = resolveColorTheme(preferences, dark, true).tokens;
        assert.ok(contrastRatio(high['--secondary'], high['--surface']) >= 7);
        assert.ok(contrastRatio(high['--blue'], high['--blue-soft']) >= 7);
        for (const foreground of [
          '--lunar-ink',
          '--weekday-ink',
          '--hint-ink',
          '--muted',
          '--outside-ink',
          '--red',
          '--green',
          '--yellow',
          '--purple',
        ] as const)
          assert.ok(contrastRatio(high[foreground], high['--surface']) >= 7);
        for (const role of ['red', 'green', 'yellow', 'purple'] as const)
          assert.ok(contrastRatio(high[`--outside-${role}`], high['--surface']) >= 7);
      }
});

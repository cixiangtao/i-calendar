import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  colorThemes,
  colorContrastIssues,
  colorTokenGroups,
  contrastRatio,
  isAccentColor,
  parseCustomColors,
  resolveColorTheme,
} from '../src/color-theme.js';
import { parseSavedState } from '../src/store.js';

test('旧设置补齐主题默认值，新设置与无效自定义配色有明确边界', () => {
  const legacy = {
    schemaVersion: 1,
    preferences: { weekStartsOn: 1, appearance: 'system' },
    datasets: [],
  };
  const restored = parseSavedState(legacy);
  assert.equal(restored.preferences.colorTheme, 'clear');
  assert.equal(restored.preferences.accentColor, null);
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

test('高级配色覆盖全部界面颜色，浅深色独立，关闭后完整恢复基础主题', () => {
  const preferences = { colorTheme: 'clear' as const, accentColor: '#3269d9' };
  const baseline = resolveColorTheme(preferences, false).tokens;
  const keys = colorTokenGroups.flatMap((group) => group.items.map((item) => item.key));
  assert.deepEqual(new Set(keys), new Set(Object.keys(baseline)));
  assert.equal(keys.length, new Set(keys).size);
  const custom = parseCustomColors({
    enabled: true,
    light: Object.fromEntries(keys.map((key) => [key, '#abcdef'])),
    dark: Object.fromEntries(keys.map((key) => [key, '#123456'])),
  });
  for (const increasedContrast of [false, true]) {
    assert.ok(
      Object.values(
        resolveColorTheme({ ...preferences, customColors: custom }, false, increasedContrast)
          .tokens,
      ).every((color) => color === '#abcdef'),
    );
    assert.ok(
      Object.values(
        resolveColorTheme({ ...preferences, customColors: custom }, true, increasedContrast).tokens,
      ).every((color) => color === '#123456'),
    );
  }
  assert.deepEqual(
    resolveColorTheme({ ...preferences, customColors: { ...custom, enabled: false } }, false)
      .tokens,
    baseline,
  );
  const partial = resolveColorTheme(
    {
      ...preferences,
      customColors: parseCustomColors({ enabled: true, light: { '--red': '#123456' }, dark: {} }),
    },
    false,
  ).tokens;
  assert.deepEqual(partial, { ...baseline, '--red': '#123456' });
});

test('高级对比度提示检查覆盖后的真实色值，不改写选色或阻止保存', () => {
  const customColors = parseCustomColors({
    enabled: true,
    light: {
      '--ink': '#ffffff',
      '--surface': '#ffffff',
      '--switch-thumb': '#000000',
      '--leaf': '#000000',
    },
    dark: {},
  });
  const tokens = resolveColorTheme(
    { colorTheme: 'clear', accentColor: null, customColors },
    false,
  ).tokens;
  const issues = colorContrastIssues(tokens);
  assert.equal(issues.find((item) => item.token === '--ink')?.ratio, 1);
  assert.equal(issues.find((item) => item.token === '--switch-thumb')?.minimum, 3);
  assert.equal(
    colorContrastIssues(tokens, true).find((item) => item.token === '--ink')?.minimum,
    7,
  );
  assert.equal(tokens['--ink'], '#ffffff');
  assert.equal(customColors.light['--ink'], '#ffffff');
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
        assert.equal(result.accent, accentColor ?? preset.accent);
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
        assert.ok(contrastRatio(t['--selected-ink'], t['--blue-soft']) >= 4.5);
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

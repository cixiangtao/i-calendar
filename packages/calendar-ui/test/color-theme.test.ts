import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  colorThemes,
  contrastRatio,
  isAccentColor,
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
        for (const background of ['--surface', '--control', '--red-soft'] as const)
          assert.ok(contrastRatio(t['--outside-ink'], t[background]) >= 3);
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
                  (foreground.startsWith('--outside-') ? 3 : 4.5),
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

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:1420');
const url = new URL(`/@fs${path.join(root, 'packages/calendar-ui/src/calendar.css')}`, origin);
url.search = 'direct';
const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
assert.ok(response.ok, `开发样式请求失败：HTTP ${response.status}`);
const stylesheet = postcss.parse(await response.text());
const rules = new Map();
stylesheet.walkRules((rule) => {
  for (const selector of rule.selectors) {
    const declarations = rules.get(selector) ?? new Map();
    rule.walkDecls((declaration) => declarations.set(declaration.prop, declaration.value));
    rules.set(selector, declarations);
  }
});

for (const [selector, property, expected] of [
  ['.tw-bg-control', 'background-color', 'var(--control)'],
  ['.tw-bg-action-soft', 'background-color', 'var(--blue-soft)'],
  ['.tw-bg-leaf', 'background-color', 'var(--leaf)'],
  ['.tw-text-secondary', 'color', 'var(--secondary)'],
  ['.tw-text-action', 'color', 'var(--blue)'],
  ['.tw-border-line', 'border-color', 'var(--line)'],
])
  assert.equal(rules.get(selector)?.get(property), expected, `开发服务缺失主题规则：${selector}`);
assert.match(
  rules.get('.tw-font-sans')?.get('font-family') ?? '',
  /-apple-system/,
  '开发服务未加载项目字体配置',
);
assert.ok(
  [...rules.keys()].some((selector) => selector.includes('mac\\:')),
  '开发服务未加载 Mac 平台变体',
);
console.log('PASS：运行中的开发服务已加载项目主题色、字体与平台变体');

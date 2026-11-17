import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ReleaseNotes } from '../src/ReleaseNotes.js';
import { ReleaseNotesDisclosure } from '../src/ReleaseNotesDisclosure.js';

const render = (source: string) =>
  renderToStaticMarkup(createElement(ReleaseNotes, { source, onOpenLink: () => {} }));

test('正式中文说明渲染为紧凑标题、段落、列表、强调和行内代码', async () => {
  const notes = await readFile(new URL('../../../docs/releases/1.2.1.md', import.meta.url), 'utf8');
  const html = render(notes);
  assert.match(html, /<h3[^>]*>i日历 1\.2\.1<\/h3>/);
  assert.match(html, /<h4[^>]*>更新体验<\/h4>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>/);
  assert.match(html, /<strong>Mac 仍采用/);
  assert.match(html, /<code>SHA256SUMS\.txt<\/code>/);
  assert.doesNotMatch(html, /## 更新体验|\*\*Mac/);
  assert.doesNotMatch(html, /<h1\b/);
});

test('有序与嵌套列表、引用和代码块保留语义，普通文本仍可直接阅读', () => {
  const html = render('1. 第一步\n2. 第二步\n   - 子项\n\n> 引用\n\n```text\nhello\n```');
  assert.match(html, /<ol\b/);
  assert.match(html, /<ul>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code/);
  assert.match(render('普通中文说明'), /普通中文说明/);
  assert.doesNotThrow(() => render(''));
  assert.doesNotThrow(() => render('**未闭合的强调\n[未闭合链接](https://'));
});

test('原始HTML和JSX作为文本，不挂载脚本、样式、表单或自定义组件', () => {
  const html = render(
    '<script>alert(1)</script>\n\n<iframe src="https://example.com"></iframe>\n\n<style>body{display:none}</style>\n\n<input autofocus />\n\n<ReleaseNoteLink href="https://example.com" onOpenLink={() => alert(1)} />',
  );
  assert.doesNotMatch(html, /<(?:script|iframe|style|input|ReleaseNoteLink)\b/i);
  assert.match(html, /&lt;script&gt;/);
});

test('仅HTTPS无凭据外链可交互，危险协议、相对地址与带凭据地址仅保留文字', () => {
  assert.match(
    render('[官网](https://example.com/path#intro)'),
    /href="https:\/\/example\.com\/path#intro"/,
  );
  for (const href of [
    'javascript:alert%281%29',
    'data:text/html,hello',
    'file:///tmp/test',
    'http://example.com',
    '//example.com',
    '#intro',
    'https://user:password@example.com',
  ]) {
    assert.doesNotMatch(render(`[链接](${href})`), /<a\b/);
  }
});

test('Markdown图片只显示替代文字，不加载远程图片或数据URL', () => {
  const html = render(
    '![图片描述](https://example.com/tracker.png)\n\n![数据图片](data:image/png;base64,abc)',
  );
  assert.doesNotMatch(html, /<img\b|\bsrc=/);
  assert.match(html, /图片描述/);
});

test('未展开说明时不渲染正文，保留原生折叠入口', () => {
  const html = renderToStaticMarkup(
    createElement(ReleaseNotesDisclosure, { source: '# 尚未展开的正文', onOpenLink: () => {} }),
  );
  assert.match(html, /<details/);
  assert.match(html, /<summary>更新说明<\/summary>/);
  assert.doesNotMatch(html, /尚未展开的正文/);
});

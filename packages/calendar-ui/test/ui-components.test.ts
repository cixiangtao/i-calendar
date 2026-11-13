import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CalendarButton } from '../src/CalendarButton.js';
import { CalendarInput } from '../src/CalendarInput.js';
import { CalendarSelect } from '../src/CalendarSelect.js';
import { CalendarSwitch } from '../src/CalendarSwitch.js';
import { CalendarTabs } from '../src/CalendarTabs.js';
import { optionKey } from '../src/ui-utils.js';

test('按钮保留原生提交类型，加载时阻止重复操作且保留可访问名称', () => {
  const normal = renderToStaticMarkup(
    createElement(CalendarButton, { type: 'submit' }, '应用格式'),
  );
  assert.match(normal, /type="submit"/);
  assert.doesNotMatch(normal, /disabled=""/);
  const loading = renderToStaticMarkup(
    createElement(CalendarButton, { loading: true }, '检查新版本'),
  );
  assert.match(loading, /disabled=""/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-label="检查新版本"/);
});

test('文本输入保留系统输入和错误关联，开关向辅助技术暴露真实受控状态', () => {
  const input = renderToStaticMarkup(
    createElement(CalendarInput, {
      id: 'clock',
      value: 'HH:mm',
      onChange: () => {},
      maxLength: 48,
      'aria-invalid': true,
      'aria-describedby': 'clock-error',
      disabled: true,
    }),
  );
  assert.match(input, /type="text"/);
  assert.match(input, /aria-invalid="true"/);
  assert.match(input, /aria-describedby="clock-error"/);
  assert.match(input, /maxLength="48"/i);
  const toggle = renderToStaticMarkup(
    createElement(CalendarSwitch, {
      checked: true,
      onChange: () => {},
      loading: true,
      'aria-label': '自动检查',
    }),
  );
  assert.match(toggle, /role="switch"/);
  assert.match(toggle, /aria-checked="true"/);
  assert.match(toggle, /disabled=""/);
});

test('选择器不混淆数字与字符串，触发器保留名称及禁用语义', () => {
  assert.notEqual(optionKey(1), optionKey('1'));
  const markup = renderToStaticMarkup(
    createElement(CalendarSelect, {
      label: '月份',
      value: 1,
      disabled: true,
      onChange: () => {},
      options: [{ value: 1, label: '1月' }],
    }),
  );
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-label="月份"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /1月/);
});

test('设置标签页保留 tab/tabpanel 关联，只初始化选中页面', () => {
  const markup = renderToStaticMarkup(
    createElement(CalendarTabs, {
      defaultValue: 'general',
      items: [
        { key: 'general', label: '常规', children: '已挂载常规内容' },
        { key: 'menu', label: '菜单栏', children: '尚未访问的格式草稿' },
      ],
    }),
  );
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /role="tabpanel"/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /aria-controls="[^"]+"/);
  assert.match(markup, /已挂载常规内容/);
  assert.doesNotMatch(markup, /尚未访问的格式草稿/);
});

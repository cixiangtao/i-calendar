import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { ReleaseNotes } from '../../../packages/calendar-ui/src/ReleaseNotes.js';

/** 隔离冒烟在真实 WebView 验证解析和外链事件，不挂载到用户页面或调用系统浏览器。 */
export function verifyReleaseNotes() {
  const container = document.createElement('div');
  const root = createRoot(container);
  const opened: string[] = [];
  try {
    flushSync(() =>
      root.render(
        createElement(ReleaseNotes, {
          source:
            '# 版本说明\n\n- **排版**与 `code`\n\n[官网](https://example.com/release)\n\n[拒绝](javascript:alert%281%29)\n\n![图片](https://example.com/image.png)\n\n<script>alert(1)</script>',
          onOpenLink: (url) => {
            opened.push(url);
          },
        }),
      ),
    );
    if (
      !container.querySelector('h3') ||
      !container.querySelector('li strong') ||
      !container.querySelector('code') ||
      container.querySelector('script, img') ||
      container.querySelectorAll('a').length !== 1
    )
      throw new Error('Markdown 更新说明渲染或内容隔离失败');
    container.querySelector('a')!.click();
    if (opened.length !== 1 || opened[0] !== 'https://example.com/release')
      throw new Error('Markdown 外链未交给平台接口');
    return true;
  } finally {
    flushSync(() => root.unmount());
  }
}

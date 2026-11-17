import { Component, lazy, Suspense, useState, type ReactNode } from 'react';

import type { ReleaseNotesProps } from './ReleaseNotes.js';

const MarkdownNotes = lazy(() =>
  import('./ReleaseNotes.js').then(({ ReleaseNotes }) => ({ default: ReleaseNotes })),
);

/** 渲染模块加载或解析失败时只回退说明内容，不影响下载、安装和日历。 */
class ReleaseNotesBoundary extends Component<
  { source: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div>
        <p>排版暂时不可用，以下为原始说明。</p>
        <p className="tw-whitespace-pre-wrap tw-overflow-anywhere">{this.props.source}</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** 展开说明才加载 Markdown 分包；原生 details 保留键盘操作及展开状态语义。 */
export function ReleaseNotesDisclosure({ source, onOpenLink }: ReleaseNotesProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="application-update-notes tw-mt-2 tw-text-xs tw-leading-5 [&_summary]:tw-cursor-pointer"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>更新说明</summary>
      {expanded ? (
        <ReleaseNotesBoundary source={source}>
          <Suspense
            fallback={
              <output className="tw-mt-2 tw-block tw-text-secondary">正在加载更新说明…</output>
            }
          >
            <MarkdownNotes
              source={source}
              onOpenLink={onOpenLink}
            />
          </Suspense>
        </ReleaseNotesBoundary>
      ) : null}
    </details>
  );
}

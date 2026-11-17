import Markdown from 'markdown-to-jsx/react';
import { memo, type ComponentProps } from 'react';

/** 说明内容来自版本清单；外链通过宿主打开，不参与更新包下载地址的选择。 */
export interface ReleaseNotesProps {
  source: string;
  onOpenLink: (url: string) => void;
}

function externalHref(href: string | undefined) {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function ReleaseNoteLink({
  href,
  title,
  children,
  onOpenLink,
}: Pick<ComponentProps<'a'>, 'href' | 'title' | 'children'> & {
  onOpenLink: ReleaseNotesProps['onOpenLink'];
}) {
  const url = externalHref(href);
  if (!url) return <span>{children}</span>;
  return (
    <a
      href={url}
      title={title}
      className="tw-text-action tw-underline tw-decoration-[1px] tw-underline-offset-2"
      onClick={(event) => {
        event.preventDefault();
        onOpenLink(url);
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        onOpenLink(url);
      }}
    >
      {children}
    </a>
  );
}

function ImageDescription({ alt }: Pick<ComponentProps<'img'>, 'alt'>) {
  // 更新说明保留图片描述，不发起图片请求或让远程资源改变菜单栏布局。
  return alt ? <span>{alt}</span> : null;
}

/** 仅使用 React 渲染入口；隔离原始 HTML，复用日历主题与紧凑排版。 */
export const ReleaseNotes = memo(function ReleaseNotes({ source, onOpenLink }: ReleaseNotesProps) {
  return (
    <Markdown
      className="release-notes tw-min-w-0 tw-max-w-full tw-text-xs tw-leading-5 tw-text-ink tw-overflow-anywhere [&_blockquote]:tw-mx-0 [&_blockquote]:tw-my-2 [&_blockquote]:tw-border-0 [&_blockquote]:tw-border-l [&_blockquote]:tw-border-solid [&_blockquote]:tw-border-line [&_blockquote]:tw-pl-3 [&_code]:tw-rounded [&_code]:tw-bg-control [&_code]:tw-px-1 [&_code]:tw-py-0.5 [&_code]:tw-font-mono [&_code]:tw-text-[11px] [&_li>ol]:tw-my-1 [&_li>p]:tw-mb-1 [&_li>ul]:tw-my-1 [&_li]:tw-my-1 [&_ol]:tw-my-2 [&_ol]:tw-list-decimal [&_ol]:tw-pl-5 [&_p]:tw-mb-2 [&_p]:tw-mt-0 [&_pre]:tw-my-2 [&_pre]:tw-max-w-full [&_pre]:tw-overflow-x-auto [&_pre]:tw-rounded-lg [&_pre]:tw-bg-control [&_pre]:tw-p-2 [&_pre_code]:tw-bg-transparent [&_pre_code]:tw-p-0 [&_strong]:tw-font-semibold [&_strong]:tw-text-ink [&_table]:tw-my-2 [&_table]:tw-block [&_table]:tw-max-w-full [&_table]:tw-border-collapse [&_table]:tw-overflow-x-auto [&_td]:tw-border [&_td]:tw-border-solid [&_td]:tw-border-line [&_td]:tw-p-1.5 [&_th]:tw-border [&_th]:tw-border-solid [&_th]:tw-border-line [&_th]:tw-p-1.5 [&_ul]:tw-my-2 [&_ul]:tw-list-disc [&_ul]:tw-pl-5"
      options={{
        forceBlock: true,
        forceWrapper: true,
        wrapper: 'div',
        disableParsingRawHTML: true,
        evalUnserializableExpressions: false,
        overrides: {
          h1: {
            component: 'h3',
            props: { className: 'tw-mb-2 tw-mt-4 tw-text-sm tw-font-semibold' },
          },
          h2: {
            component: 'h4',
            props: { className: 'tw-mb-2 tw-mt-4 tw-text-[13px] tw-font-semibold' },
          },
          h3: {
            component: 'h5',
            props: { className: 'tw-mb-2 tw-mt-3 tw-text-xs tw-font-semibold' },
          },
          h4: {
            component: 'h6',
            props: { className: 'tw-mb-2 tw-mt-3 tw-text-xs tw-font-semibold' },
          },
          h5: {
            component: 'h6',
            props: { className: 'tw-mb-2 tw-mt-3 tw-text-xs tw-font-semibold' },
          },
          h6: {
            component: 'h6',
            props: { className: 'tw-mb-2 tw-mt-3 tw-text-xs tw-font-semibold' },
          },
          a: { component: ReleaseNoteLink, props: { onOpenLink } },
          img: ImageDescription,
        },
      }}
    >
      {source}
    </Markdown>
  );
});

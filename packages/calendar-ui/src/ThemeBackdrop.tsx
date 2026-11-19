import { useState } from 'react';

import { themeImageUrl } from './theme-image.js';
import type { ThemeBackground } from './theme-package.js';

type ImageStatus = (source: string, loaded: boolean) => void;

/** 预览和画布都用原生图片元素加载，在线图加载前保留底色。 */
export function ThemeBackgroundImage({
  background,
  className,
  loading,
  onImageStatus,
}: {
  background: ThemeBackground;
  className?: string;
  loading?: 'lazy';
  onImageStatus?: ImageStatus;
}) {
  const [readyUrl, setReadyUrl] = useState('');
  const src = themeImageUrl(background);
  return (
    <img
      key={src}
      alt=""
      draggable={false}
      src={src}
      loading={loading}
      referrerPolicy="no-referrer"
      className={className}
      style={{
        objectPosition: background.x + '% ' + background.y + '%',
        opacity: background.strength / 100,
        visibility: background.url && readyUrl !== src ? 'hidden' : undefined,
      }}
      onLoad={() => {
        if (background.url) setReadyUrl(src);
        onImageStatus?.(src, true);
      }}
      onError={() => {
        setReadyUrl('');
        onImageStatus?.(src, false);
      }}
    />
  );
}

/** 应用画布和主题预览共享可裁切的装饰图片层。 */
export function ThemeBackdrop({
  background,
  dark,
  onImageStatus,
}: {
  background: ThemeBackground | undefined;
  /** 预览可单独指定明暗，应用画布默认使用当前外观。 */
  dark?: boolean;
  onImageStatus?: ImageStatus;
}) {
  if (!background || !background.strength) return null;
  return (
    <div
      className="theme-backdrop"
      aria-hidden="true"
      data-dark={dark}
    >
      <ThemeBackgroundImage
        background={background}
        onImageStatus={onImageStatus}
      />
    </div>
  );
}

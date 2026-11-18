import { themeImageUrl } from './theme-image.js';
import type { ThemeBackground } from './theme-package.js';

/** 应用画布和主题预览共享可裁切的装饰图片层。 */
export function ThemeBackdrop({
  background,
  dark,
}: {
  background: ThemeBackground | undefined;
  /** 预览可单独指定明暗，应用画布默认使用当前外观。 */
  dark?: boolean;
}) {
  if (!background || !background.strength) return null;
  return (
    <div
      className="theme-backdrop"
      aria-hidden="true"
      data-dark={dark}
    >
      <img
        alt=""
        draggable={false}
        src={themeImageUrl(background)}
        style={{
          objectPosition: String(background.x) + '% ' + String(background.y) + '%',
          opacity: background.strength / 100,
        }}
      />
    </div>
  );
}

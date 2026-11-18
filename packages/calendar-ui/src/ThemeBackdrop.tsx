import { themeImageUrl } from './theme-image.js';
import type { ThemeBackground } from './theme-package.js';

/** 月份工具栏及编辑预览共用图片层，阅读区由实色主题底承载。 */
export function ThemeBackdrop({
  background,
  dark,
}: {
  background: ThemeBackground | undefined;
  dark: boolean;
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

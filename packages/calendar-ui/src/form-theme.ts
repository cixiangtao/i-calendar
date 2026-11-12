import type { ThemeConfig } from 'antd/es/config-provider';

import type { resolveColorTheme } from './color-theme.js';

const metrics = { height: 28, radius: 8, fontSize: 13, lineHeight: 20, inset: 8, gap: 8 };

/** CSS 与组件主题共用可见尺寸；触控只扩大透明点击区域。 */
export const formControlVariables = {
  '--form-height': `${metrics.height}px`,
  '--form-radius': `${metrics.radius}px`,
  '--form-font-size': `${metrics.fontSize}px`,
  '--form-line-height': `${metrics.lineHeight}px`,
  '--form-inset': `${metrics.inset}px`,
  '--form-gap': `${metrics.gap}px`,
  '--form-duration': '130ms',
};

/** 统一 Ant Design 表单控件的尺寸、明暗配色与中性状态反馈。 */
export function createFormTheme(t: ReturnType<typeof resolveColorTheme>['tokens']): ThemeConfig {
  return {
    token: {
      colorPrimary: t['--blue'],
      colorText: t['--ink'],
      colorTextSecondary: t['--secondary'],
      colorTextTertiary: t['--muted'],
      colorTextPlaceholder: t['--secondary'],
      colorTextDisabled: t['--muted'],
      colorBgContainerDisabled: t['--control'],
      colorBgContainer: t['--surface'],
      colorBgElevated: t['--surface'],
      colorBgTextHover: t['--control-hover'],
      colorBgTextActive: t['--control-active'],
      colorBorder: t['--line'],
      colorBorderSecondary: t['--line'],
      controlOutline: t['--secondary'],
      controlOutlineWidth: 1,
      controlItemBgHover: t['--control-hover'],
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: metrics.fontSize,
      lineHeight: metrics.lineHeight / metrics.fontSize,
      borderRadius: metrics.radius,
      controlHeight: metrics.height,
      motionDurationFast: '0.13s',
      motionDurationMid: '0.13s',
      motionDurationSlow: '0.13s',
    },
    components: {
      Button: {
        paddingInline: metrics.inset,
        fontWeight: 500,
        defaultColor: t['--ink'],
        defaultBg: t['--control'],
        defaultBorderColor: 'transparent',
        defaultHoverColor: t['--ink'],
        defaultHoverBg: t['--control-hover'],
        defaultHoverBorderColor: 'transparent',
        defaultActiveColor: t['--ink'],
        defaultActiveBg: t['--control-active'],
        defaultActiveBorderColor: 'transparent',
        textTextColor: t['--blue'],
        textTextHoverColor: t['--blue'],
        textTextActiveColor: t['--blue'],
        textHoverBg: t['--control-hover'],
        defaultShadow: 'none',
        primaryShadow: 'none',
        dangerShadow: 'none',
      },
      Input: {
        paddingInline: metrics.inset,
        paddingBlock: 3,
        inputFontSize: metrics.fontSize,
        hoverBg: t['--control-hover'],
        activeBg: t['--control'],
        hoverBorderColor: t['--secondary'],
        activeBorderColor: t['--secondary'],
        activeShadow: 'none',
        errorActiveShadow: 'none',
        warningActiveShadow: 'none',
      },
      Segmented: {
        trackPadding: 2,
        trackBg: t['--control'],
        itemColor: t['--secondary'],
        itemHoverColor: t['--ink'],
        itemHoverBg: t['--control-hover'],
        itemActiveBg: t['--control-active'],
        itemSelectedBg: t['--surface'],
        itemSelectedColor: t['--ink'],
        boxShadowTertiary: 'none',
      },
      Switch: {
        trackHeight: 20,
        trackMinWidth: 36,
        handleSize: 16,
        handleShadow: 'none',
        colorPrimary: t['--leaf'],
        colorPrimaryHover: t['--leaf-hover'],
        colorTextQuaternary: t['--switch-off'],
        colorTextTertiary: t['--switch-off-hover'],
      },
    },
  };
}

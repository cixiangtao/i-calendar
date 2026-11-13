/** 三端控件共用几何值；Tailwind 直接引用变量，触控只扩大透明命中区域。 */
const metrics = { height: 28, radius: 8, fontSize: 13, lineHeight: 20, inset: 8, gap: 8 };
export const formControlVariables = {
  '--form-height': `${metrics.height}px`,
  '--form-radius': `${metrics.radius}px`,
  '--form-font-size': `${metrics.fontSize}px`,
  '--form-line-height': `${metrics.lineHeight}px`,
  '--form-inset': `${metrics.inset}px`,
  '--form-gap': `${metrics.gap}px`,
  '--form-duration': '130ms',
};

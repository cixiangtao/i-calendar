---
name: 拾日历
description: 菜单栏与网页共用的松绿公农历小月历
colors:
  jade: '#146e5e'
  jade-dark-appearance: '#6bcfb5'
  holiday: '#af2638'
  holiday-dark-appearance: '#ff9299'
  makeup: '#985319'
  makeup-dark-appearance: '#f5b477'
  selected-text: '#ffffff'
  surface: '#ffffff'
  surface-dark: '#202421'
  ink: '#252d29'
  ink-dark: '#edf3ef'
  secondary: '#626f68'
  secondary-dark: '#a4b2a9'
typography:
  headline:
    fontFamily: 'system-ui'
    fontSize: '20px'
    fontWeight: 600
  title:
    fontFamily: 'system-ui'
    fontSize: '14px'
    fontWeight: 600
  date:
    fontFamily: 'system-ui'
    fontSize: '16px'
    fontWeight: 500
    fontFeature: 'tnum'
  summary:
    fontFamily: 'system-ui'
    fontSize: '13px'
    fontWeight: 600
  body:
    fontFamily: 'system-ui'
    fontSize: '12px'
  label:
    fontFamily: 'system-ui'
    fontSize: '11px'
rounded:
  day: '7px'
  summary: '9px'
  web-container: '14px'
spacing:
  compact: '7px'
  section: '15px'
  inset: '20px'
components:
  selected-day:
    backgroundColor: '{colors.jade}'
    textColor: '{colors.selected-text}'
    rounded: '{rounded.day}'
    height: '42px'
  date-summary:
    rounded: '{rounded.summary}'
    padding: '11px 10px'
---

# Design System: 拾日历

## Overview

**Creative North Star: "随手翻开的松绿小月历"**

沿用用户确认的 A“月历优先”方向，以公农历双行、松绿选择态和轻量休班标记组织信息。日历保持紧凑，设置在同一界面内进入与返回。

视觉规范由共享 React 界面与 CSS 实现，Mac 使用 Tauri 的系统 WebView。Web 采用相同月历，介绍位于首屏之后。iOS 复用该实现并处理安全区域与触控尺寸，尚未在模拟器或真机验证。

**Key Characteristics:**

- 系统字体、清晰的公农历层级和固定七列六周。
- 松绿组织选择和节气，红色提示休息日，赭色提示补班。
- 今日描边、选中填充和休班文字各自表达事实。
- 调休未知状态直接写明，来源在设置中可查。

## Colors

松绿用于选择、品牌图标、节气和来源操作；深色使用更亮的松绿强调色，选中背景保留深松绿配白字。红色用于休息日数字，赭色用于补班，二者始终配合“休/班”文字。

浅色采用白色表面和深色文字，深色采用暗绿灰表面与浅色文字。摘要以轻染表面区分区域，边线只用于事件与设置分组。

**The Selection Rule.** 选中的实心背景、今天的细描边、休班的文字标记分别表达不同事实，不能互相替代。

## Typography

字体优先使用 macOS/iOS 系统字体与苹方，无需下载字体。月份标题、品牌、日期数字、摘要及农历标签分别使用 frontmatter 中的角色。日期数字使用等宽数字特性，触控环境日期数字增至（17px）。

农历与节日标签保持单行，长名称省略并在可访问名称和日期摘要中保留完整信息；摘要的农历说明在窄屏允许换行。

## Layout

共享月历七列六周，包含相邻月日期，日期范围边界用空格补齐。Web 容器宽（400px），最小宽度（320px）；宽屏在首屏居中，窄于（430px）时取消外层阴影与圆角，靠近顶部。官网介绍和许可证入口在首屏之后。

Mac 窗口为（400 × 660）逻辑像素，无系统标题栏；日历单元高（40px），窗口内允许滚动以容纳提示与设置。Web 常规单元高（42px），触控环境高（46px）；主要工具按钮触控目标至少（44px）。iOS 入口使用 safe-area-inset，但这些处理仍需设备验证。

## Elevation & Depth

Web 宽屏日历使用轻微环境阴影（0 12px 48px #143b2510）。Mac 窗口由系统提供阴影，内容不再叠加卡片阴影。移动窄屏与设置区域主要依靠间距、轻染色和细线组织信息。

## Shapes

日期、工具按钮与控件采用轻圆角；摘要容器比日期稍柔和。Web 外层圆角只用于宽屏，Mac 和移动窄屏贴合宿主边界。图标为统一线性 SVG，使用圆端点与圆连接。

## Components

月份导航由原生 HTML 年月选择器与 Ant Design 按钮组成，支持直接跳转、切月、回到今天和范围禁用。主月历使用 grid/row/gridcell 语义、单一 Tab 入口、方向键选日与完整中文可访问名称。

日期摘要显示月日、星期、完整农历、干支生肖及休班状态；有复制按钮和来源右键菜单。“接下来的日子”始终从今天计算，跨年日期显式标年。

设置使用 Ant Design Segmented 切换周起始日和外观，按钮触发手动更新与 JSON 文件选择器。更新中显示加载状态，失败保留原数据并给出可关闭提示；设置返回键可聚焦，Esc 返回后焦点回齿轮。

## Do's and Don'ts

- **Do** 保持七列六周和公农历双行的稳定布局。
- **Do** 将今日、选中和休班状态分别表达。
- **Do** 明确标出未收录年份，并保留来源入口。
- **Do** 让官网首屏可以直接查日期。
- **Don't** 将普通周末解释为已确认的法定放假。
- **Don't** 在首屏加入宣传、下载或注册流程。
- **Don't** 将手机浏览器截图写成 iOS 设备验证。
- **Don't** 重新维护 SwiftUI 或另一套跨平台日历界面。

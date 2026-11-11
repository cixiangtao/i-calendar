---
name: 拾日历
description: 原生 macOS 菜单栏里的公农历与放假调休小月历
colors:
  jade: "rgb(8% 43% 37%)"
  jade-dark-appearance: "rgb(42% 81% 71%)"
  holiday: "rgb(69% 15% 20%)"
  holiday-dark-appearance: "rgb(100% 55% 56%)"
  makeup: "rgb(62% 33% 7%)"
  makeup-dark-appearance: "rgb(96% 68% 37%)"
  selected-text: "white"
typography:
  headline:
    fontFamily: "system-ui"
    fontSize: "21pt"
    fontWeight: 600
  title:
    fontFamily: "system-ui"
    fontSize: "14pt"
    fontWeight: 600
  date:
    fontFamily: "system-ui"
    fontSize: "16pt"
    fontWeight: 500
    fontFeature: "tnum"
  summary:
    fontFamily: "system-ui"
    fontSize: "13pt"
    fontWeight: 600
  body:
    fontFamily: "system-ui"
    fontSize: "12pt"
  label:
    fontFamily: "system-ui"
    fontSize: "11pt"
  caption:
    fontFamily: "system-ui"
    fontSize: "10pt"
rounded:
  badge: "4pt"
  control: "7pt"
  summary: "9pt"
spacing:
  column: "2pt"
  week: "3pt"
  tight: "4pt"
  small: "8pt"
  medium: "10pt"
  page: "20pt"
components:
  day-selected:
    backgroundColor: "{colors.jade}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.control}"
    width: "48.5714pt"
    height: "40pt"
    typography: "{typography.date}"
  day-default:
    rounded: "{rounded.control}"
    width: "48.5714pt"
    height: "40pt"
    typography: "{typography.date}"
  month-navigation:
    rounded: "{rounded.control}"
    width: "27pt"
    height: "28pt"
    typography: "{typography.label}"
  schedule-badge:
    rounded: "{rounded.badge}"
    width: "17pt"
    height: "17pt"
    typography: "{typography.label}"
  selected-summary:
    rounded: "{rounded.summary}"
    padding: "8pt 11pt"
    typography: "{typography.summary}"
  upcoming-row:
    height: "25pt"
    typography: "{typography.body}"
---

# Design System: 拾日历

## Overview

**Creative North Star: "随手翻开的松绿小月历"**

沿用用户确认的 A 月历优先方向，项目名称确定为“拾日历”。视觉由清楚的公农历双行、松绿选中态和轻量休班标记组成。白天是白色表面，夜间跟随原生深色文本背景；信息密度服务于随手查日期。

这里记录已实现的 macOS 菜单栏弹层。iOS 目前只有共享 Swift 数据包，Web 只有 ESM 核心，尚无可据此宣称完成的界面或响应式规范。

该描述是对实现的归纳，不是新增品牌命名。规范以 `CalendarView.swift`、`CalendarModel.swift` 和五张最终截图 `work/review-final-{light,holidays,dark,settings,missing}.png` 为证据。前置元数据记录源码显式值；原生长度单位为 pt，截图为两倍像素呈现，不应把截图 px 当作布局 pt。

**Key Characteristics:**
- 原生系统字体、控件与明暗外观。
- 固定七列六周，公历数字与农历副标题各有稳定基线。
- 松绿组织选择与节气，红色提示休息日，赭色提示补班。
- 调休未知状态用文字明确表达。

## Colors

主色克制、功能色清楚，系统动态中性色承载大部分信息。前置元数据保留 Swift 显式 RGB 通道比例；颜色管理可能使截图采样值略有不同。

### Primary

- **松绿**（`jade`）：浅色下的日历图标、节气和节日副标题、事件日期、休假标记及强调信息；选中日期背景在两种外观中均使用这一深松绿。
- **夜间松绿**（`jade-dark-appearance`）：深色外观的强调前景。最终截图中的年月标题也呈松绿；菜单标题的最终绘制依原生控件样式，不另造专用标题色。
- **轻染表面**：强调色在浅色下使用 7% 不透明度、深色下使用 13%，用于工具按钮与日期摘要。日期悬停使用 8%。

### Secondary

- **休息日红 / 夜间柔红**（`holiday` / `holiday-dark-appearance`）：周末表头、当月休息日期数字；补班周末恢复普通日期前景。周末红色本身不表示已确认法定放假。
- **补班赭 / 夜间暖赭**（`makeup` / `makeup-dark-appearance`）：补班文字标记与图例。

### Neutral

- **原生文本背景**：`NSColor.textBackgroundColor`，最终浅色图呈白色，深色图呈原生深灰黑。不要从截图固定一个深色十六进制值。
- **主文字 / 次文字**：SwiftUI `.primary` / `.secondary`，随系统明暗变化。相邻月份数字和副标题均降为次文字。
- **选中白字**（`selected-text`）：选中日期数字、农历与休班角标共用。缺失数据的页脚圆点使用系统橙色，错误文案使用系统红色；它们属于原生语义色。

**The Selection Rule.** 选择的实心松绿背景、今日的细描边、休班的文字标记分别表达不同事实，不能互相替代。

## Typography

**Display Font / Body Font:** 原生 SwiftUI `.system`，前置元数据以 `system-ui` 表示字体角色；中文使用系统中文回退。无外部展示字体，也无独立巨幅 Display 层级。

公历数字承担主扫描，农历及状态保留清晰的第二行。层级对应前置元数据中的 `headline`、`title`、`date`、`summary`、`body`、`label` 和 `caption`。今日及选中日期的数字提升为 semibold，其余日期为 medium。日期数字启用等宽数字；未来事件日期使用系统 rounded 设计并启用等宽数字。

农历副标题使用 label 角色；休班角标也使用 label 角色并提升为 semibold。副标题优先显示节日，其次节气，最后农历日期；农历初一显示月名。日历日期主副文字的中心基线位于格内 y=11pt 与 y=31pt。节名内容不得挤动数字列。

## Layout

当前已实现界面是固定（392 × 620pt）的 macOS 菜单栏弹层，外边距使用 page。没有针对 iPhone、平板或浏览器的已实现断点。整体从上到下依次为品牌与设置入口、年月与切月工具、星期行、月历网格、休班图例、选中日期摘要、后续事件、数据状态页脚。年月是快速定位入口，主体月历始终先于详情。

月历固定七列六行，共 42 个位置，包含相邻月份日期。每格尺寸见 `day-default`；列与周间距见 spacing。星期行同样均分七列。月份变化、节日文字及选中态均不改变网格几何。相邻月份日期仍可点选并导航到对应月份。

后续事件保留两行：下一节气与下一假期（无假期时回退到节日）；整行可点击。日期列固定（74pt），右侧为“今天”或“n天后”。列表依据真实今天，而非当前浏览月份计算；标题旁明确标注“从今天起”。事件跨越今天所在年份，或浏览月份位于不同年份时，日期显示完整年份。底部数据状态借助 Spacer 和分隔线保持在弹层下方。

设置在同一弹层内切换，包含返回、显示偏好、调休数据与更新、来源及退出。设置主体采用纵向 ScrollView，最小内容高度（580pt）；保留内容增长时的滚动能力。

## Elevation & Depth

内容使用平面与轻染表面表达层级。自定义日格、摘要和事件列表没有独立投影；细分隔线区隔事件与页脚。系统 NSPopover 的容器、原生分段选择器与标准按钮由 macOS 绘制，包括系统边缘和阴影，不提取为应用自定义阴影 token。当前没有显式自定义动画或时长 token。

## Shapes

形状来自克制的小圆角矩形：图例角标、日期与工具控件、日期摘要分别使用 frontmatter 的 badge、control、summary 圆角。今日未选中时绘制强调色内描边（1pt）；选中时改为实心背景。休班状态是文字信息，不做大面积胶囊标签。数据状态圆点为（5pt）。

## Components

### 日期按钮

轻量而精确，完整保留 Button 语义。Canvas 只负责固定两条文字基线与右上角的“休 / 班”；外层按钮包含完整公历、农历、节名、休班或未知状态的可访问标签，选中时带 `.isSelected`。默认透明，悬停轻染；今日描边，选中实心松绿并全白字。按钮焦点采用原生行为，没有自定义焦点圈或焦点动画 token。

### 月份导航与今天

年份、月份通过原生 Menu 选择；左右工具按钮有中文帮助和可访问名称。左右方向键切月，T 回今天，Escape 关闭弹层。日期范围边界禁用对应切月按钮，禁用透明度（35%）。今天按钮水平内边距（10pt），高度与工具按钮相同。设置齿轮触发区域为（28 × 28pt）。

### 休班图例

使用带浅色底的“休 / 班”小方块，后接次文字“放假 / 补班”。图例底色为各自功能色 9% 不透明度。网格内角标直接绘制文字；选中状态下角标变为白色，位置保持一致。

### 选中日期摘要

轻染圆角容器。左侧以 summary 角色显示月日与星期，次行给出完整农历、干支与生肖；右侧呈现工作日、周末、放假、补班日或“调休未收录”，再显示节日或节气。摘要提供原生右键菜单，可复制日期与农历；有来源时提供来源入口。

### 后续事件行

整行是普通样式按钮，日期为松绿，事件名为主文字，倒计时为次文字。长标题单行显示；不要牺牲完整年份与倒计时基准。两条事件之间使用系统 Divider，不增加独立卡片或阴影。

### 设置控件与反馈

周起始日与外观为系统 segmented Picker；外观选项为跟随系统、浅色、深色。检查更新与导入 JSON 使用原生按钮；更新过程中显示 mini ProgressView 并禁用这两个动作。成功或无新数据反馈用强调色，失败反馈用系统红色。来源使用原生 Link；目前浅色设置截图呈系统蓝色，不强制重画为主题绿。没有实现自定义输入框，因此不定义输入框视觉 token。

### 数据覆盖与验证状态

缺失年份同时在图例行显示“本年调休未收录”、摘要显示“调休未收录”、底部明确年份，并以橙色圆点提示。农历、节气和节日仍可展示，但不得把缺失年度描述为已知放假安排。

本次最终图覆盖浅色、密集休班、深色、设置与缺失年份。独立 finish reviewer 将六项修复均判为 resolved，disposition 为 ship，未见明显视觉回归；打包后 .app 的实际 NSPopover 打开、关闭和重新打开程序化生命周期检查通过；ZIP 解压至另一目录后同样通过，资源可独立加载。最终快照在 NSApplication.finishLaunching 且 NSHostingView 显示于原生 NSWindow 后捕获，以避开离屏字形残片；这不是 CUA 鼠标操作。这些结论不等于鼠标实操或 VoiceOver 已通过：两者尚未直接测试。sidecar 中 HTML/CSS 是原生组件的独立预览翻译；系统绘制、点按语义和可访问性以 SwiftUI/AppKit 实现为准。

## Do's and Don'ts

### Do:
- **Do** 保持七列六周与日期双基线，长节名不改变列宽。
- **Do** 让选中态、今日描边、休班文字各自表达独立含义。
- **Do** 在深色外观中使用明亮松绿、柔红和暖赭，同时保留深松绿选中背景与白字。
- **Do** 对跨年事件写出年份，并保留“从今天起”的倒计时基准。
- **Do** 保留可访问 Button、完整中文日期标签与选中语义；后续仍需实测 VoiceOver。
- **Do** 将来源、更新状态和“调休未收录”放在可发现的位置。

### Don't:
- **Don't** 将系统动态颜色写死为截图取样色。
- **Don't** 将普通周末红字解释为已知法定放假；休班须由数据与文字共同表达。
- **Don't** 用阴影卡片、装饰渐变或大字号宣传层级覆盖现有轻量信息结构。
- **Don't** 把未实现的 iOS/Web UI、未实测的鼠标或 VoiceOver 行为写成验证通过。

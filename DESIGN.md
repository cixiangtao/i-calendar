---
name: 拾日历
description: 红绿蓝黄紫五色分工的圆润公农历小月历
colors:
  canvas: '#f1f2f6'
  surface: '#ffffff'
  ink: '#171b24'
  secondary: '#5b6575'
  muted: '#6e7787'
  line: '#e4e7ed'
  control: '#f4f5f8'
  hover: '#f7f8fa'
  blue: '#3269d9'
  blue-soft: '#eff3fc'
  red: '#cf3049'
  red-soft: '#fff0f2'
  green: '#16804d'
  green-soft: '#eaf7ef'
  yellow: '#956300'
  yellow-soft: '#fff5d8'
  purple: '#8150bd'
  purple-soft: '#f4edfc'
  canvas-dark: '#171b23'
  surface-dark: '#222630'
  ink-dark: '#f6f7fb'
  secondary-dark: '#acb4c3'
  muted-dark: '#929dac'
  line-dark: '#3a3e48'
  control-dark: '#303642'
  hover-dark: '#2d313a'
  blue-dark: '#7a9ee6'
  blue-soft-dark: '#242f48'
  red-dark: '#ff94a3'
  red-soft-dark: '#452c37'
  green-dark: '#83d9ab'
  green-soft-dark: '#263d36'
  yellow-dark: '#ebc568'
  yellow-soft-dark: '#423b29'
  purple-dark: '#c6a4f2'
  purple-soft-dark: '#3b304b'
  leaf-blue: '#3269d9'
  leaf-ink: '#ffffff'
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '13px'
    fontWeight: 500
    lineHeight: '20px'
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '15px'
    fontWeight: 600
    lineHeight: '20px'
  date:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '19px'
    fontWeight: 600
    lineHeight: '22px'
    fontFeature: 'tnum'
  date-compact:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '18px'
    fontWeight: 600
    lineHeight: '21px'
    fontFeature: 'tnum'
  date-wide:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '22px'
    fontWeight: 600
    lineHeight: '27px'
    fontFeature: 'tnum'
  leaf:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '28px'
    fontWeight: 500
    lineHeight: '32px'
    fontFeature: 'tnum'
  leaf-wide:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '46px'
    fontWeight: 500
    lineHeight: '54px'
    fontFeature: 'tnum'
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '13px'
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: '11px'
    lineHeight: '14px'
rounded:
  mark: '4px'
  status: '6px'
  control: '10px'
  toolbar: '8px'
  day: '12px'
  leaf: '13px'
  panel-compact: '18px'
  leaf-wide: '19px'
  panel-mobile: '20px'
  panel: '22px'
  circle: '50%'
spacing:
  micro: '4px'
  grid: '5px'
  compact: '8px'
  panel-gap-mac: '10px'
  panel-gap: '12px'
  wide-gap: '16px'
  panel-inset: '18px'
  section-inset: '20px'
  wide-inset: '24px'
components:
  selected-day:
    backgroundColor: '{colors.blue-soft}'
    textColor: '{colors.blue}'
    rounded: '{rounded.day}'
    height: '46px'
  today-button:
    backgroundColor: '{colors.blue-soft}'
    textColor: '{colors.blue}'
    rounded: '{rounded.toolbar}'
    padding: '0'
    height: '28px'
  month-select:
    backgroundColor: '{colors.control}'
    textColor: '{colors.ink}'
    rounded: '{rounded.toolbar}'
    padding: '4px 8px'
  panel:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.panel}'
    padding: '18px'
  date-leaf:
    backgroundColor: '{colors.leaf-blue}'
    textColor: '{colors.leaf-ink}'
    rounded: '{rounded.leaf}'
    width: '50px'
    height: '58px'
---

# Design System: 拾日历

## Overview

**Creative North Star: "圆润五色小月历"**

以用户确认的“圆润五色小月历”为视觉方向：浅灰画布托住独立白色面板，日期数字先被看见，农历与节日节气保持第二层。红、绿、蓝、黄、紫各自承担信息任务，轻染背景提供温和分组，避免把所有日期涂成彩色。

Mac 保留随手展开的紧凑上下布局；宽屏网页让月历与日期详情并排，小屏回到上下排列并允许纵向滚动。统一系统字体、圆润边角与细线图标，使共享视图在不同平台仍是同一本小日历。

**Key Characteristics:**

- 五色按语义分工，颜色始终配合文字或形状。
- 公历数字主导扫描，农历、节日与节气单行呈现。
- 选中描边、今日圆点、休班角标分别表达事实。
- 白色圆角面板与浅灰画布分层，面板本身不使用投影。

## Colors

Frontmatter 记录清爽白默认运行时色值；完整规则以共享 UI 的 `color-theme.ts` 为准，CSS 首帧提供回退值。`-dark` 为深色外观，不是悬停色。柔和底色降低大面积彩色的压迫感，正文与次级文字使用中性灰层级。

### Primary

- **操作强调色**：清爽白默认为蓝色，用于选择描边、今日圆点、回到今天、品牌图标与来源操作；预设或自定义强调色可覆盖这一角色，轻染同色用于选择与工具背景。
- **日期叶片**：使用强调色派生的深底色与白字，独立保证白字对比度。

### Secondary

- **日常红**：周末与放假日期数字；确认放假才使用浅红底和“休”角标。
- **节气绿**：节气标签与后续节气日期，也用于正常工作状态、已收录数据与成功反馈。

### Tertiary

- **暖金黄**：补班“班”字与浅黄底；调休未知提示也使用这一提醒色。
- **节日紫**：节日名称与后续节日日期；在日期次级标签中节日优先于节气。

### Neutral

- **浅灰画布 / 白色面板**：分开宿主背景与可阅读内容；深色转换为深灰画布和略亮面板。
- **墨色 / 次级灰 / 月外灰**：分别用于日期正文、农历和说明、相邻月份日期。月外的确认放假仍保留红色公农历文字。
- **控件灰 / 悬停灰 / 分隔灰**：服务年月标签、轻按钮、行悬停和详情分区，不争抢日期层级。

**The Five Colors Rule.** 默认蓝色组织选择与系统操作，可通过主题和自定义强调色更换；红色提示休假和周末，绿色标示节气，黄色标示补班与数据未知，紫色标示节日；保持配套文字，不以颜色单独传达状态。

**The Independent States Rule.** 强调色内描边和轻染底色代表选中，左上同色圆点代表今天，“休/班”角标代表已收录安排。三种状态可以叠加，不能互相替代。

## Typography

全界面使用 Apple 系统字体、苹方与系统回退，不加载外部字体。字重以中等到半粗为主，日期和叶片数字使用等宽数字特性。frontmatter 的字号是实际角色，响应变化在下方补充。

- **Headline**：月份工具栏统一为 13px / 500 / 20px，图标框同为 13px；各端不再按断点放大。
- **Title**：设置标题；常规详情标题为（13px），宽屏为（14px）。
- **Date / Date Compact / Date Wide**：分别对应普通月历、Mac 紧凑月历、宽屏月历；短屏宽屏会回落至（19px / 23px 行高）。
- **Leaf / Leaf Wide**：详情叶片的大号数字，数字变化时短暂淡入上移。
- **Body**：基础界面文字；事件名称与操作多使用（12px），设置说明使用（12px / 1.8 行高）。
- **Label**：农历、状态和辅助信息；宽屏农历为（12px / 17px 行高），宽屏短于（700px）回落为（11px / 14px 行高）。

农历、节日和节气在日期格内保持单行；长名称省略，完整文本留在可访问名称和日期详情。不要因标签过长挤压公历数字。

## Layout

月历固定七列六周，展示相邻月日期，范围之外用空位补齐。基础容器宽度为 `min(400px, 100%)`，视口最小宽（320px）。基础面板间距（12px），月份面板内边距（18px）；常规日期格高（46px）、列与行间距（5px）。

Mac 为（400 × 660）逻辑像素，上月历下详情；外侧内边距（10px）、面板间距（10px）、圆角（18px），日期格高（40px）。内容容器可以纵向滚动，设置同样可以滚动。

Web 从（860px）起使用月历与（280px）详情双栏，总宽最大（960px），列间距（16px）。月历内边距（24px），日期格高为 `clamp(44px, 6.4vh, 60px)`，网格间距（8px）。右栏叶片居中，下面直接呈现所选日期的完整黄历；设置改为单栏（560px）宽。

小于等于（430px）时采用上下卡片、（12px）外侧内边距与（20px）面板圆角。粗指针环境主要工具、年月选择器、来源操作等触控目标至少（44px），日期格高（48px）；320px 触控布局中，年份、切月分组与今天保持单行，按钮至少 44px。小屏首屏放不下时通过纵向滚动读取详情。iOS 入口已考虑安全区域，但没有据此宣称完成模拟器或真机验证。

## Elevation & Depth

**The Flat Panels Rule.** 内容面板用画布色差、留白和少量分隔线建立层次，不添加装饰性卡片投影。Mac 外部窗口阴影由系统负责。

选中日期的 `inset 0 0 0 2px var(--blue)` 是状态描边，不是浮起阴影。设置使用 Ant Design 默认 Segmented 的选项层次及按钮轻微深度，属于控件本身，不扩展为面板投影。键盘焦点使用蓝色（2px）外描边与（3px）偏移。

## Shapes

整体圆润简洁：通用面板（22px）、手机面板（20px）、Mac 面板（18px）；普通日期（12px）、Mac 日期（10px）。年月标签与工具按钮用（10px）圆角；齿轮与复制类图标按钮用圆形。状态小签、休班角标的圆角更小，避免和主面板等重。

日期叶片为带双圆孔的蓝色小日历剪影，普通尺寸（50 × 58px）、宽屏（84 × 94px）、小屏（44 × 54px）；圆角分别用 Leaf 与 Leaf Wide。图标采用统一细线 SVG 和圆端点。

## Components

### 月份标签与导航

年月使用真实 select，Mac、窄屏、宽屏统一为浅灰圆角控件，文字与图标框均为 13px、文字字重 500、行高 20px；可见高度 28px，圆角 8px。年份宽 72px、月份宽 48px，方向按钮可见区域 28×28px，今天宽 44px。

工具栏左侧为“年份＋〈月份〉”，右侧独立放“今天”。触控端只扩大透明点击区域至至少 44px，不改变底色、圆角、字重、字号或可见高度；方向按钮之间的间距按可用宽度调整。跨端优先调整布局结构，同一控件不额外切换视觉样式。

网页日历顶部对齐、水平居中，不再按黄历详情总高度垂直居中；切月或回到今天时，详情长短变化不移动顶部工具栏。Mac 维持固定窗口中的上月历、下详情。

### 日期格

公历数字在上，农历或节日节气在下；选中采用浅蓝底、蓝字、蓝色内描边，次级标签改为墨色。今日独立显示左上（4px）蓝点。确认放假使用浅红底与右上红底白字“休”；补班使用浅黄底黄字“班”。普通周末只标红数字，不出现放假底色和角标。

悬停使用控件灰，切换背景与描边以（130ms ease-out）过渡。网格支持单 Tab 入口、方向键选日、完整中文日期名称；视觉样式不能替代语义。

### 日期角标与状态小签

不额外设置“休／班”图例行，直接使用日期角标和选中日期状态表达；仅在年度调休未收录时于月历底部显示文字提示。详情中的工作日小签绿字浅绿底，放假/周末红字浅红底，补班/调休未知黄字浅黄底；节日或节气补充文字使用紫色。

### 日期叶片与详情

叶片白色数字和双孔使用强调色派生底色。紧凑详情为叶片与日期说明两列，状态放在日期说明下方，复制仅放在摘要右键菜单中；宽屏改为竖向居中。叶片数字切换使用（160ms cubic-bezier(0.16, 1, 0.3, 1)）淡入与（2px）上移；减少动态偏好会将动画与过渡缩短至（0.01ms）。

### 调休数据入口

根据用户反馈移除“接下来的日子”，将注意力集中在所选日期和黄历。日期详情底部不再显示调休覆盖入口；未收录年份由月历提示和日期摘要文字明确表示，数据维护仍通过顶部设置进入。

### 设置控件与容器

独立圆角面板，顶部返回入口使用强调色文字，分区用灰线与间距。周起始日和外观使用灰底 Segmented、选中项由 Ant Design 呈现；数据更新与 JSON 导入是描边按钮。反馈区成功绿、错误红，更新中显示加载，失败保留原数据。配色区提供三套预设按钮、系统颜色选择器与恢复默认操作。预设选择同时重置强调色，明暗外观独立设置。

### 黄历详情

沿用当前圆角与五色语义：不显示“传统黄历”标题，年月日干支以“丙午年 · 己亥月 · 庚寅日”单行居中呈现，字号 13px、行高 22px、下间距 10px；不使用背景块或上下标签，辅助技术仍保留完整的年/月/日干支名称。宜忌与方位保持左对齐：宜为绿色标签、忌为红色标签；冲煞与五种方位使用两列文字，完整事项自然换行。日期详情到方位信息结束，不附带来源口径折叠区。详情面板上下内边距统一 12px；紧凑布局的摘要下间距 10px，干支区顶部内边距 12px，宜忌段间隔 10px、正文行高 22px，方位行间距 6px，分隔线上下各 12px。保持原有字号和完整内容，通过间距控制密度。

所有尺寸都在日期摘要之后直接呈现同一份完整黄历，不使用独立详情页。Mac 保留上方月历，下方详情占用剩余高度并独立滚动；窄屏网页上下排列、自然纵向滚动。860px 以上网页在右栏展示，右栏独立滚动，各段不收缩，避免长宜忌覆盖日期摘要。来源口径保留在核心元信息和项目文档中。

统一详情阶段参考：[宽屏](docs/images/统一详情-宽屏.png)、[菜单栏内容尺寸预览](docs/images/统一详情-菜单栏.png)、[窄屏](docs/images/统一详情-窄屏.png)。图片来自浏览器布局验证，不代表 iOS 实测；图片保留统一详情阶段的底部入口；当前已按反馈删除来源口径与调休覆盖入口。此前独立黄历页截图同样保留为历史记录。

## 主题与文字层级

主要文字、次级说明和月外日期使用三个固定中性色角色；普通主题的文字目标为 4.5:1，系统增加对比度偏好下相关文字目标提升至 7:1。背景提供清爽白、暖纸色、雾灰蓝三套预设，浅深色分别定义，红绿黄紫语义保持稳定。极端强调色保存原始值，按背景派生可读文字与叶片底色。详见[配色与文字层级](docs/配色与文字层级.md)。

## Do's and Don'ts

### Do:

- **Do** 保持七列六周、公农历双行和当前月份的扫描层级。
- **Do** 保留选中描边、今日圆点与休班文字各自含义。
- **Do** 让节气、节日、补班按五色语义出现，并保留完整日期详情。
- **Do** 让 Mac 紧凑上下排列，宽屏 Web 双栏，小屏可以纵向滚动。
- **Do** 明确显示年度调休未知状态并提供来源入口。

### Don't:

- **Don't** 将普通周末的红字解释为已确认放假，也不要补造未收录年份的休班角标。
- **Don't** 将所有日期填成彩色，或用深色实心填充替代当前蓝色描边选择态。
- **Don't** 将宽屏双栏强加给菜单栏窗口，或在窄屏固定高度裁掉详情。
- **Don't** 在日历首屏插入广告、下载推广或注册流程。

---
name: i日历
description: 红绿蓝黄紫五色分工的圆润公农历小月历
colors:
  canvas: '#f1f2f6'
  surface: '#ffffff'
  ink: '#303030'
  secondary: '#626262'
  muted: '#6e6e6e'
  line: '#e4e7ed'
  control: '#f4f5f8'
  control-hover: '#e8e9ec'
  control-active: '#e0e1e4'
  hover: '#f7f8fa'
  brand-blue: '#3269d9'
  blue: '#2d5fc3'
  blue-soft: '#eff3fc'
  red: '#d71a38'
  red-soft: '#fdeff1'
  green: '#007f49'
  green-soft: '#edf7f3'
  yellow: '#946200'
  yellow-soft: '#f8f4ed'
  purple: '#8b4fc5'
  purple-soft: '#f7f3fb'
  canvas-dark: '#171b23'
  surface-dark: '#222630'
  ink-dark: '#f3f3f3'
  secondary-dark: '#c8c8c8'
  muted-dark: '#aaaaaa'
  line-dark: '#3a3e48'
  control-dark: '#303642'
  control-hover-dark: '#444954'
  control-active-dark: '#4f545e'
  hover-dark: '#2d313a'
  blue-dark: '#b3c8f1'
  blue-soft-dark: '#242f48'
  red-dark: '#ff8d9b'
  red-soft-dark: '#453641'
  green-dark: '#72d6a1'
  green-soft-dark: '#2f4242'
  yellow-dark: '#edc56b'
  yellow-soft-dark: '#423f39'
  purple-dark: '#c6a0ed'
  purple-soft-dark: '#3c3a4e'
  leaf-blue: '#3269d9'
  leaf-ink: '#ffffff'
  lunar-ink: '#6e6e6e'
  lunar-ink-dark: '#b5b5b5'
  weekday-ink: '#4b4b4b'
  weekday-ink-dark: '#d0d0d0'
  hint-ink: '#707070'
  hint-ink-dark: '#a8a8a8'
  selected-ink: '#303030'
  selected-ink-dark: '#f3f3f3'
  outside-red: '#b2374b'
  outside-red-dark: '#e197a0'
  outside-green: '#277956'
  outside-green-dark: '#86c7a4'
  outside-purple: '#815aa7'
  outside-purple-dark: '#bca4d6'
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
  control: '8px'
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
  panel-gap-mac: '8px'
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
    padding: '0 8px'
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

# Design System: i日历

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

- **操作强调色**：清爽白默认为蓝色，用于选择描边、今日圆点、回到今天与来源操作；预设或自定义强调色可覆盖这一角色，轻染同色用于选择与工具背景。
- **品牌蓝**：固定用于小写 `i` 日历 Logo，与可配置的操作强调色分离；深色主题仍保持同一品牌色。
- **日期叶片**：使用强调色派生的深底色与白字，独立保证白字对比度。

### Secondary

- **日常红**：周末与放假日期数字；确认放假才使用浅红底和“休”角标。
- **节气绿**：节气标签与后续节气日期，也用于正常工作状态、已收录数据与成功反馈。

### Tertiary

- **暖金黄**：补班“班”字与浅黄底；调休未知提示也使用这一提醒色。
- **节日紫**：节日名称与后续节日日期；在日期次级标签中节日优先于节气。

### Neutral

- **浅灰画布 / 白色面板**：分开宿主背景与可阅读内容；深色转换为深灰画布和略亮面板。
- **炭灰 / 标签灰 / 农历灰 / 说明灰 / 月外灰**：公历、正文与干支值使用炭灰；星期栏、标签、农历和辅助说明按阅读角色分层。相邻月份使用弱化灰和较轻字重，周末、节气、节日保留弱化后的语义色，确认休假仍有底色及角标。
- **控件灰 / 悬停灰 / 分隔灰**：服务年月标签、轻按钮、行悬停和详情分区，不争抢日期层级。

**The Five Colors Rule.** 默认蓝色组织选择与系统操作，可通过主题和自定义强调色更换；红色提示休假和周末，绿色标示节气，黄色标示补班与数据未知，紫色标示节日；保持配套文字，不以颜色单独传达状态。

**The Brand Identity Rule.** 品牌 Logo 固定使用 frontmatter 的品牌蓝，不随主题或自定义操作强调色变化；彩色源为共享 SVG，菜单栏模板仅表达相同的小写 i 与日历轮廓。

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

Mac 宽度为 400 逻辑像素，上月历下详情，日历窗口随完整内容调整高度；外侧内边距（8px）、面板间距（8px）、内部面板圆角（18px），月历与详情内边距（上下 10px、左右 12px），设置面板内边距（12px），日期格高（40px）。高度受当前屏幕工作区限制，上下各保留 8px；屏幕不足时由整个日历滚动，详情卡片不单独滚动。设置窗口目标高度维持 660px，内容区独立滚动。

Mac 最外层无边框悬浮窗使用 20px 原生圆角：AppKit 内容视图图层裁切整棵 WebView，窗口背景透明以去除四角矩形底色，保留系统阴影。圆角覆盖日历和设置页面，独立于内部 18px 面板圆角；圆角随内容高度变化保持生效。

品牌与设置放在日历内容最下方，作为日历根容器的轻量底部工具栏，透明底色、无额外卡片或边框；基础高度为 28px、左右内边距 12px，触控沿用既有点击区域，沿用 19px Logo 与现有设置按钮。紧凑布局中位于农历详情卡片下面，宽屏位于两张卡片下方并横跨双栏；月历卡片直接从年月切换开始。工具栏沿正常文档流排布，不覆盖详情，顺序与键盘导航一致；短窗口可随整个日历滚动访问。工具栏与卡片沿用当前容器间距，设置页面只保留自身返回栏，不重复展示工具栏。

Web 从（860px）起使用月历与（280px）详情双栏，总宽最大（960px），列间距（16px）。月历内边距（24px），日期格高为 `clamp(44px, 6.4vh, 60px)`，网格间距（8px）。右栏叶片居中，下面直接呈现所选日期的完整黄历；设置改为单栏（560px）宽。

小于等于（430px）时采用上下卡片、（12px）外侧内边距与（20px）面板圆角。粗指针环境主要工具、年月选择器、来源操作等触控目标至少（44px），日期格高（48px）；320px 触控布局中，年份、切月分组与今天保持单行，按钮至少 44px。小屏首屏放不下时通过纵向滚动读取详情。iOS 入口已考虑安全区域，但没有据此宣称完成模拟器或真机验证。

## Elevation & Depth

**The Flat Panels Rule.** 内容面板用画布色差、留白和少量分隔线建立层次，不添加装饰性卡片投影。Mac 外部窗口阴影由系统负责。

选中日期的 `inset 0 0 0 2px var(--blue)` 是状态描边，不是浮起阴影。设置使用 Ant Design 默认 Segmented 的选项层次及按钮轻微深度，属于控件本身，不扩展为面板投影。普通操作的键盘焦点使用蓝色（2px）外描边与（3px）偏移；统一下拉选择器采用下文的轻量中性焦点样式。

## Shapes

整体圆润简洁：通用面板（22px）、手机面板（20px）、Mac 面板（18px）；普通日期（12px）、Mac 日期（10px）。年月标签与工具按钮用（10px）圆角；齿轮与复制类图标按钮用圆形。状态小签、休班角标的圆角更小，避免和主面板等重。

日期叶片为带双圆孔的蓝色小日历剪影，普通尺寸（50 × 58px）、宽屏（84 × 94px）、小屏（44 × 54px）；圆角分别用 Leaf 与 Leaf Wide。图标采用统一细线 SVG 和圆端点。

## Components

### 品牌 Logo

以小写 `i` 与日历纸组成独立品牌标记，保留圆润五色小月历的既有世界。彩色唯一源为 `packages/calendar-ui/src/assets/logo.svg`：画布（64 × 64px）、蓝色底圆角（14px），白色日历纸位于（12px, 15px）、尺寸（40 × 39px）、圆角（8px）；双装订缺口、蓝色圆点与短竖构成小写 `i`。共享品牌栏显示（19 × 19px），网页 favicon 与其同源；不能用字体字符替代图形或跟随用户强调色重染。

Mac 应用图标保留（80/1024）的外边距；菜单栏源为 `apps/calendar/src-tauri/icons/tray.svg`，透明底单色（44 × 44px），按（22 × 22）逻辑像素使用，原生启用 `icon_as_template` 由系统着色。通用（1024 × 1024px）PNG 铺满底色，供后续 iOS 图标资源接入；当前未完成完整 Xcode 工程编译、模拟器或设备验收。

修改图标后统一运行 `pnpm run build:icons`：`scripts/build-icons.mjs` 使用 `rsvg-convert` 与系统 `iconutil` 生成 Mac PNG、ICNS、favicon 与 `tray.png`，临时文件位于 `work/brand/`，PNG 随附 `Source` 元数据。不要分别手改各平台位图。品牌预览见 `docs/images/i日历-品牌预览.png`，本轮宽窄屏视觉证据见 `docs/images/i日历-宽屏.png` 与 `docs/images/i日历-手机.png`。

### 月份标签与导航

年月与菜单栏时间格式复用 `CalendarSelect`，基于项目已有 Ant Design Select 封装，不再使用系统原生下拉列表。Mac、窄屏、宽屏统一为浅灰圆角控件，文字为 13px / 500 / 20px；方向按钮图标框为 13px，下拉指示为 10px，均沿用同一细线风格。可见高度 28px，圆角 8px。年份宽 72px、月份宽 50px，年月分组间隔 4px，方向按钮可见区域 28×28px，今天宽 44px。

弹出列表使用主题面板色、1px 分隔色边框、12px 圆角及 4px 内边距；列表项为 13px / 20px、8px 圆角，普通指针下最小高度 32px，触控下最小高度 44px。选中项使用普通文字与次要文字色的小勾，不染强调色、不加粗；悬停和键盘活动项使用控件灰。触发器展开时保持中性灰底，鼠标与触控不显示焦点框；键盘操作时只在触发器外显示 1px 次要文字色细描边，偏移 1px，清除底层默认的叠加描边与光圈。触控只扩大按钮的透明点击区域，保持 28px 的可见底色。列表展开时保持当前值的文字对比度，不采用底层组件默认的透明淡化。Esc 优先关闭列表，窗口失焦关闭列表；关闭后再按 Esc 继续执行日历原有行为。组件接口见[选择器组件](docs/选择器组件.md)。

工具栏左侧为“年份＋〈月份〉”，右侧独立放“今天”。触控端只扩大透明点击区域至至少 44px，不改变底色、圆角、字重、字号或可见高度；方向按钮之间的间距按可用宽度调整。跨端优先调整布局结构，同一控件不额外切换视觉样式。

网页日历顶部对齐、水平居中，不再按黄历详情总高度垂直居中；切月或回到今天时，详情长短变化不移动顶部工具栏。Mac 维持上月历、下详情，窗口按完整内容调整高度。

### 日期格

公历数字在上，农历或节日节气在下；选中采用浅蓝底、蓝字、蓝色内描边，普通农历标签使用选中墨色，节气与节日保留绿色和紫色，并校验在选中底色上的对比度。今日独立显示左上（4px）蓝点。确认放假使用浅红底与右上红底白字“休”；补班使用浅黄底黄字“班”。普通周末只标红数字，不出现放假底色和角标。

悬停使用控件灰，切换背景与描边以（130ms ease-out）过渡。网格支持单 Tab 入口、方向键选日、完整中文日期名称；视觉样式不能替代语义。

### 日期角标与状态小签

不额外设置“休／班”图例行，直接使用日期角标和选中日期状态表达；仅在年度调休未收录时于月历底部显示文字提示。详情中的工作日小签绿字浅绿底，放假/周末红字浅红底，补班/调休未知黄字浅黄底；日期摘要中的节气用绿色、节日用紫色，配合完整名称与可访问标签区分。

### 日期叶片与详情

叶片白色数字和双孔使用强调色派生底色。紧凑详情为叶片与日期说明两列，摘要统一三层：第一层依次展示公历日期与星期、节气、全部节日、休班状态；第二层为农历日期与年月日干支；第三层只展示生肖与星座。第一层使用紧凑横向流，空间不足时自然换行，日期与星期保持完整；不省略节日，也不因节日存在而隐藏同日节气。复制仅放在摘要右键菜单中；宽屏改为竖向居中。叶片数字切换使用（160ms cubic-bezier(0.16, 1, 0.3, 1)）淡入与（2px）上移；减少动态偏好会将动画与过渡缩短至（0.01ms）。

下方信息行展示生肖和星座，标签使用次级灰，数值用主要文字色和 500 字重，字号 11px、行高 18px。生肖与星座保留在同一辅助信息行，宽度不足时自然换行；节日和节气归入日期行，农历与干支独立成层，避免混杂与重复生肖。各端使用同一份核心结果。

### 调休数据入口

根据用户反馈移除“接下来的日子”，将注意力集中在所选日期和黄历。日期详情底部不再显示调休覆盖入口；未收录年份由月历提示和日期摘要文字明确表示，数据维护仍通过顶部设置进入。

### 设置控件与容器

设置采用顶部文字标签：“常规”包含日历显示与配色，“菜单栏”包含时间显示与格式（仅 Mac），“数据”包含调休覆盖、更新、导入与同步记录，“关于”首先展示应用名称、版本与免费无广告说明，并包含来源、日期口径和键盘操作；Mac 的退出入口放在应用信息区。版本号读取根 `package.json`，与网页介绍共用版本来源。默认进入常规；标签使用 13px 文字，当前标签以墨色文字和 20px 宽的中性短下划线提示，不使用彩色块或厚重选中边框。标签最小宽度 44px，普通指针下最小高度 34px，触控下最小高度 44px。

返回栏、标签与全局反馈固定，仅当前标签内容滚动；移除设置页的固定页脚，版本说明与退出操作集中到关于页。Mac 设置沿用窗口内可用高度；网页面板高度为 `min(640px, 100svh - 64px)`，430px 以下采用 `100svh - 24px`。非活动面板隐藏但不销毁，避免切页丢失时间格式草稿和滚动位置。文件输入独立于懒加载面板，取消选择的监听始终存在；导入与保存反馈在所有标签可见。

表单统一遵循[表单控件规范](docs/表单控件规范.md)：可见高 28px、圆角 8px、文字 13px、横向内边距 8px、同行间距 8px、行间距 12px。Select、输入框、按钮与分段选择共用中性悬停/按下反馈和 130ms 过渡，键盘焦点为 1px 中性细描边；错误输入用红色，禁用只弱化一次。开关保留 36×20px 轨道与 16px 白色滑块，触控只扩大透明命中区域。几何值与 Ant Design 主题集中在 `form-theme.ts`，状态色仍由 `color-theme.ts` 生成。

独立圆角面板，顶部返回入口使用强调色文字，分区用灰线与间距。周起始日和外观使用灰底 Segmented、选中项由 Ant Design 呈现；数据更新与 JSON 导入使用统一的中性底色按钮。反馈区成功绿、错误红，更新中显示加载，失败保留原数据。配色区提供三套预设按钮、系统颜色选择器与恢复默认操作。预设选择同时重置强调色，明暗外观独立设置。

Mac 的“菜单栏”标签包含“菜单栏显示”分区：“显示图标”和“显示菜单栏时间”两个开关、紧凑格式选择器、自定义输入与“应用格式”按钮，均沿用当前主题文字和控件色。图标与有效时间文字至少保留一项，最后一个可见入口对应的开关保持禁用，并显示简短原因；隐藏图标时空白格式不能应用。时间格式预览使用灰底单行容器及等宽数字，过长时自然换行；秒级变化不触发读屏播报。非法格式显示红色反馈并禁用应用按钮。Web 与 iOS 不显示此标签；输入时 Esc 仍可返回日历并恢复设置按钮焦点。

### 黄历详情

“常规 → 日历显示”提供“显示农历详情”开关，默认开启，控制整张日期详情卡片，不影响月历格内的农历、节气、节日或休班信息。关闭时 Mac 根据剩余月历与底部工具栏内容缩短窗口，宽屏 Web 收为最大 640px 的居中单栏，设置页结构不受影响。开启后恢复原有完整详情布局；状态自动保存，旧记录默认开启。隐藏详情时，操作反馈移至月历卡片底部，保存错误与更新提示继续可见。

沿用当前圆角与五色语义：不显示“传统黄历”标题，年月日干支移至日期摘要的农历日期后，如“农历十月初四　丙午年 · 己亥月 · 庚寅日”，移除原先独立的居中干支行和摘要中重复的干支年。农历使用农历灰，干支值使用主要文字色，紧凑布局为 11px / 17px，宽屏为 12px / 21px；空间足够时同行，窄屏自然换行，保持干支值与年/月/日后缀完整。辅助技术继续保留年/月/日干支的定义列表语义。宜忌与方位直接接在摘要分隔线后，保持左对齐：宜为绿色标签、忌为红色标签；冲煞与五种方位使用两列文字，完整事项自然换行。日期详情到方位信息结束，不附带来源口径折叠区。Web 详情面板上下内边距为 12px，Mac 为上下 10px、左右 12px；紧凑布局的摘要下间距 10px，宜忌区顶部内边距 12px，段间隔 10px、正文行高 22px，方位行间距 6px，分隔线上下各 12px。

所有尺寸均呈现同一份完整日期与黄历信息，干支位于农历日期后，宜忌与方位位于摘要后，不使用独立详情页。Mac 保留上方月历，下方详情按内容自然撑开，窗口随内容增减高度；屏幕高度不足时只保留整个日历的纵向滚动。窄屏网页上下排列，860px 以上网页在右栏展示；详情均取消高度限制与内部滚动，完整展示宜忌、冲煞与方位，网页内容超出视口时自然纵向滚动。来源口径保留在核心元信息和项目文档中。

统一详情阶段参考：[宽屏](docs/images/统一详情-宽屏.png)、[菜单栏内容尺寸预览](docs/images/统一详情-菜单栏.png)、[窄屏](docs/images/统一详情-窄屏.png)。图片来自浏览器布局验证，不代表 iOS 实测；图片保留统一详情阶段的底部入口；当前已按反馈删除来源口径与调休覆盖入口。此前独立黄历页截图同样保留为历史记录。

## 主题与文字层级

主要文字采用中性炭灰，星期、详情标签、农历、说明和月外日期使用独立中性色角色；月外主要通过灰色与较轻字重降低层级。普通主题的文字目标为 4.5:1，系统增加对比度偏好下相关文字目标提升至 7:1。背景提供清爽白、暖纸色、雾灰蓝三套预设，浅深色分别定义，红绿黄紫语义保持稳定。极端强调色保存原始值，按背景派生可读文字与叶片底色。详见[配色与文字层级](docs/配色与文字层级.md)。

## Do's and Don'ts

### Do:

- **Do** 让小写 `i` 日历 Logo 使用固定品牌蓝，并从共享 SVG 生成平台资源。
- **Do** 保持七列六周、公农历双行和当前月份的扫描层级。
- **Do** 保留选中描边、今日圆点与休班文字各自含义。
- **Do** 让节气、节日、补班按五色语义出现，并保留完整日期详情。
- **Do** 让 Mac 紧凑上下排列，宽屏 Web 双栏，小屏可以纵向滚动。
- **Do** 明确显示年度调休未知状态并提供来源入口。

### Don't:

- **Don't** 让品牌 Logo 随用户强调色变化，或分别手改生成的图标位图。
- **Don't** 将普通周末的红字解释为已确认放假，也不要补造未收录年份的休班角标。
- **Don't** 将所有日期填成彩色，或用深色实心填充替代当前蓝色描边选择态。
- **Don't** 将宽屏双栏强加给菜单栏窗口，或在窄屏固定高度裁掉详情。
- **Don't** 在日历首屏插入广告、下载推广或注册流程。

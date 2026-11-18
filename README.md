# i日历

<img src="packages/calendar-ui/src/assets/logo.svg" width="80" height="80" alt="i日历 Logo" />

Mac 菜单栏里的小月历，提供公历、农历、生肖、星座、传统节日、节气、放假与补班，以及年月日干支、每日宜忌、冲煞和主要方位。免费、无广告，无需登录。

当前版本 **1.3.7**。项目已迁移为 **Tauri 2 + React + TypeScript**：Mac、iOS 和 Web 复用同一份界面、应用状态和日历核心。Mac 菜单栏应用和网页版官网已正式发布；iOS 的入口及配置已接入，工程生成、模拟器和真机验证仍需完整 Xcode 环境。

正式版提供 Mac（Apple 芯片 arm64）与网页版，iOS 在后续版本交付。官网第一屏直接使用日历，介绍与下载放在首屏之后。

- [网页版官网](https://cixiangtao.github.io/i-calendar/)
- [Mac 下载与版本说明](https://github.com/cixiangtao/i-calendar/releases/latest)
- [源码与问题反馈](https://github.com/cixiangtao/i-calendar)

Mac 首版采用本地 ad-hoc 签名，尚无 Developer ID 和 Apple 公证。请从官方 Release 下载并核对随附 SHA-256；0.1.0 预览需手动安装本版，1.0.0 起支持确认后下载并安装签名更新。长期驻留、真实重新登录、最低系统与手机 Safari 等未完整验收项继续如实保留在[验收记录](docs/1.0验收清单.md)，不宣称已完成。

**Mac 首次打开**：从官方 Release 下载并解压，将 i日历拖到「应用程序」后双击。若系统提示无法验证开发者，确认下载来源后，在「系统设置 → 隐私与安全性」为 i日历选择「仍要打开」。

项目由“拾日历”更名为“i日历”；本地目录、根包名和 Rust 程序名统一为 `i-calendar`，共享包为 `@i-calendar/core` 与 `@i-calendar/ui`，应用标识为 `local.icalendar.app`。旧名称仅保留于数据迁移和历史记录，已有偏好和缓存可继续读取。

## 快速启动

在项目目录 `/Users/xbb/Desktop/@anys/i-calendar` 执行：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run dev:mac
```

项目固定使用 pnpm 12.18.0，由 Corepack 按 `packageManager` 选择版本。以下 `pnpm` 命令均使用该版本，也可统一写成 `corepack pnpm …`。工作区使用 `pnpm-workspace.yaml`，JavaScript 依赖锁文件为 `pnpm-lock.yaml`。

Mac 开发建议使用 Node 24 LTS（至少 24.15.0，满足 release-it 工具要求）、macOS 13+、Command Line Tools 和通过 rustup 安装的 Rust。项目在 `rust-toolchain.toml` 中锁定 Rust 1.99.1，不修改系统全局默认工具链。首次运行会下载和编译 Rust 依赖，耗时比后续启动长。`dev:mac` 会自动启动前端服务，再打开菜单栏日历。

只看网页版不需要 Rust：

```sh
pnpm run dev:web
```

打开终端显示的地址，默认是 <http://127.0.0.1:1420/>。Mac 开发和 Web 开发共用此端口，请勿同时启动两个开发服务。

## Mac 应用

```sh
pnpm run build:mac
open outputs/mac/i日历.app
```

产物为 `outputs/mac/i日历.app` 和 `outputs/i日历-1.3.7-mac-arm64.zip`（文件名随本机构架变化）。当前验证环境为 Apple Silicon；应用采用本地临时签名，没有 Developer ID 签名或 Apple 公证，首版按此方式分发，安装说明见正式 Release。

- 左键菜单栏入口展开或收起；失去焦点自动收起；右键可进入设置或退出。
- Mac 弹层停靠菜单栏所在屏幕的右上方，距工作区顶部与右侧各 8px；从屏幕右侧以 280ms 原生减速动画进入。收起时以 180ms 向右滑出，动画结束后隐藏；退场中再次点击可从当前位置转回打开。系统开启“减少动态效果”时使用 120ms 淡入与 100ms 淡出。
- Mac 悬浮窗使用 20px 原生圆角，四角透明并保留系统阴影，日历和设置页面统一生效。
- Mac 菜单栏默认显示图标和 `HH:mm`，在“设置 → 菜单栏”选择是否显示图标和时间，并选择时分、时分秒、日期与星期、12 小时制或自定义格式。图标与有效时间文字至少保留一项，支持图文、仅时间、仅图标三种模式；格式与开关在本机保存，旧设置默认显示图标。
- 菜单栏时钟由原生层刷新，弹窗收起后继续走时，跟随 Mac 系统时区；日历查询仍采用北京时间。格式示例与规则见[菜单栏时间格式](docs/菜单栏时间格式.md)。
- 点日期查看完整农历和休班状态，点年月直接跳转。
- “设置 → 日出日落”支持使用当前位置或搜索国内城市及部分区县；按所选日期显示日出、日落和白昼时长。首页仅用一行显示关键时间；地名、精度和估算说明集中在设置。自动定位直接使用系统经纬度，不拿市中心代替实际位置；首次点击主动申请权限；Mac 可随时打开定位设置，等待期间可取消，已被系统拒绝时在设置中恢复。定位失败可手动回退，坐标不写入本地偏好。计算口径与验证边界见[日出日落与定位](docs/日出日落与定位.md)。
- 日期摘要按“日期、星期、节气、全部节日与休班状态 → 农历与干支 → 生肖与星座”分层，随选中日期更新。生肖以农历正月初一换年，星座采用公历月日固定区间。
- 干支、完整宜忌、冲煞和方位直接展示在所选日期下方；宽窄屏内容一致。详情卡片随内容完整展开，无需在卡片内滚动或进入另一页；Mac 窗口随内容调整高度，受屏幕可用空间限制时由整个日历滚动。
- 方向键选日，PageUp / PageDown 切月，T 回到今天，Esc 返回或收起。
- “设置 → 常规 → 显示农历详情”可隐藏或显示整张日期详情卡片，默认开启并自动保存；月历格内农历、节气和节日始终保留。关闭后 Mac 窗口自动缩短，宽屏网页收为居中的单栏月历。
- 设置支持周一/周日开始、跟随系统/浅色/深色、手动检查更新与年度 JSON 导入。
- 设置按“常规、外观、日出日落、菜单栏、数据、关于”分标签，默认进入常规；菜单栏标签仅在 Mac 显示。返回栏和标签保持可见，各页内容独立滚动，切页保留未保存的格式草稿。版本信息集中在“关于”中，Mac 的退出入口也位于该页，设置底部不再固定显示说明。
- Mac“关于”页提供应用更新：默认自动检查，发现新版后显示轻量提醒，点击可进入关于页查看说明；“稍后”收起提醒，之后仍可从设置进入关于页，不另加底部更新按钮。主题色“下载并安装”按钮经用户点击后才下载、验签、安装并重启，可关闭自动检查或手动重试。开发预览不请求更新，正式版本内置更新源与公钥；打包和验收方式见[自动更新](docs/自动更新.md)。
- 更新说明展开后按需渲染 Markdown，标题、列表、加粗、代码和链接沿用主题排版；链接通过系统浏览器打开，排版模块失败时仍可阅读原始说明并继续更新。
- Mac“设置 → 常规 → 启动”提供开机自启开关，开启后登录 Mac 时在菜单栏后台运行，不自动展开日历。状态直接读取本机启动项，开发与隔离测试不注册；详见[开机自启](docs/开机自启.md)。
- 基础交互使用 Radix Primitives，按钮、文本/颜色输入保留原生控件语义；布局与控件样式由 Tailwind 和现有主题变量共同定义。迁移保留当前视觉、键盘交互和透明触控区域，详见[组件与样式架构](docs/组件与样式架构.md)。
- Select、输入框、按钮和分段选择统一可见高度、圆角、字号与状态反馈，支持浅深色、键盘细描边和透明触控区域；详见[表单控件规范](docs/表单控件规范.md)。
- “设置 → 外观”中的“配色”提供三套主题与自定义强调色；展开“高级配色”只需设置 8 个主色，其余界面颜色自动派生，浅深色分别保存，支持预览、对比度提示与逐项恢复。
- 日期摘要右键菜单提供“复制日期与农历”，也可查看放假来源。
- 月历上方“今天”旁的计算器按钮“日期计算”提供日期间隔、自然日前后推算和工作日统计，支持 1901—2100 年；结果可直接在月历中查看，返回或按 Esc 保留原选择。工作日默认不计起始日、计入结束日，可切换为计入起始日；根据已收录的全国调休扣除休假和普通周末、计入补班，缺少参与计算日期的调休数据时明确显示无法确定。工具草稿仅在本次页面内保留，不写入偏好。
- 未收录的年份明确显示“调休未收录”，仍可查询农历、节气与黄历。

应用内置计算代码、国内地点参考点及 2025—2027 年调休快照，正常查询离线运行。首次自动定位及系统地名解析可能需要联网；定位默认关闭，由用户启用。网页首次打开和首次载入地点分包需要网络，当前未实现 Service Worker 离线重载。

## iOS 接入

需要完整 Xcode、iOS SDK、CocoaPods 和 Apple 开发团队配置。先完成 Xcode 首次启动及所需平台组件安装，然后执行：

```sh
pnpm run ios:init
pnpm run dev:ios
# 配置签名与团队后按需构建
pnpm run build:ios
```

`ios:init` 使用官方 Tauri CLI 生成 `apps/calendar/src-tauri/gen/apple` 中的 Xcode 工程；生成的工程源码应提交，Pods、用户状态和构建缓存不提交。当前机器仅有 Command Line Tools，且缺少 CocoaPods，因此没有生成或交付可验证的 iOS 工程/安装包。共享界面的手机尺寸检查不等于 iOS 模拟器或真机验证。Widget 和系统日历集成尚未实现。

## 检查与构建

```sh
pnpm run lint           # oxlint：问题和警告均须处理
pnpm run format         # oxfmt：格式化所有支持的项目文件
pnpm run format:check   # 只检查格式，不写文件
pnpm run check:dev      # 开发服务运行时检查主题色、字体与平台样式是否生成
pnpm run check          # lint、格式、类型检查、测试及 ESM/网页构建
pnpm run check:native   # Rust 测试：存储、旧数据迁移、多屏定位、菜单栏时钟
pnpm run build:mac      # 构建 Mac 应用、校验签名并生成 ZIP
pnpm run check:mac      # Rust 测试 + 已打包应用的真实 WebView 冒烟验证
pnpm run preview:web   # 预览已构建的静态网页
```

`check:mac` 使用隔离的冒烟实例，跳过偏好与调休缓存读写，可与正在运行的开发窗口并行验证；正常应用继续保持单实例。运行前先构建最新 Mac 应用。验证范围与限制见[验证记录](docs/验证记录.md)。

## 准备正式版本

确认本轮改动需要应用发版后，先提交修改与 `docs/releases/<下一版本>.md` 中文说明，再从干净的 `main` 执行：

```sh
pnpm run release:dry patch # 只预演命令，不写文件、不执行质量门禁、不推送
pnpm run release patch     # 同步各端版本、检查、提交并原子推送 main 与当前版本标签
```

仅在应用功能、共享能力或应用交付内容变化时执行上述发版命令。release-it 统一管理应用版本准备，Mac 构建、更新签名和 GitHub Release 由统一 Actions 入口完成，可同步官网；本地应用发版需要 Mac 构建环境，推送后仍须验收公开产物。官网专属改动应独立部署 Pages，纯文档与流程维护正常提交，不因此递增应用版本。官网独立部署流水线目前尚未接入，接入前不得用应用发版代替。范围判断、接入状态及失败恢复见[发布约定](docs/发布约定.md)。

## 工具链与格式约定

- 使用 oxlint 1.93.0 检查 TypeScript、React、Node 和无障碍规则，配置为 `.oxlintrc.json`。
- 使用 oxfmt 0.78.0 统一格式，启用导入排序、package.json 字段及脚本排序、Tailwind 类名排序、JSDoc、嵌入代码格式化和 JSX 单属性分行，配置为 `.oxfmtrc.json`。本轮已执行一次全项目格式化。
- oxfmt 处理其支持的源码、CSS、HTML、JSON、Markdown、YAML 和 TOML。依赖、生成文件、构建缓存、输出目录及 pnpm 锁文件交给相应工具维护；Rust 使用 `cargo fmt`。
- Tailwind CSS 3.4.19 经 PostCSS 接入 Vite，使用 `tw-` 前缀并复用已有主题变量；关闭 Preflight，保留现有基础样式和原生控件行为。选择 3.4 是为了支持当前 macOS 13 / iOS 16；Tailwind 4 要求 Safari 16.4+。
- oxlint 按自动 JSX 转换关闭旧 `react-in-jsx-scope` 规则；为兼容当前浏览器保留 `Array.sort`；仅在交互日历网格中允许显式 ARIA 行/单元格语义，其他无障碍规则继续执行。

## 目录与依赖边界

```text
packages/calendar-core/        纯 TypeScript：公农历、节气、节日、调休与数据校验
packages/calendar-ui/          共享 React 视图、应用状态与平台接口
apps/calendar/src/             Web / Tauri 平台适配及应用入口
apps/calendar/src-tauri/       Rust 壳、菜单栏、文件存储与受限系统能力
scripts/                       构建、检查、许可汇总与调休数据暂存工具
work/                          本地中间文件，不提交
outputs/                       本地应用与 ZIP，不提交
```

依赖方向为：平台入口 → 共享界面/状态 → 日历核心。核心不依赖 React、Tauri、网络、文件系统或宿主系统，不重写 Rust 历法算法。详见[架构说明](docs/ARCHITECTURE.md)和[核心契约](packages/calendar-core/README.md)。

[宽屏月历](docs/images/五色月历-网页.png) · [Mac 紧凑布局预览](docs/images/五色月历-菜单栏布局.png) · [手机深色](docs/images/五色月历-手机深色.png) · [春节休班](docs/images/五色月历-春节.png)

界面采用红绿蓝黄紫的状态配色与圆角面板。品牌与设置放在日历内容下方的无底色工具栏，紧凑布局位于农历详情卡片下面，宽屏位于两张卡片下方并横跨双栏；月历卡片直接从年月切换开始。Mac 使用宽 400px、随内容调整高度的上下布局，设置目标高度为 660px；宽屏网页采用月历与日期详情双栏；上述布局预览来自浏览器，手机图不代表 iOS 真机验证。

配色将主要文字、次要说明与相邻月日期分层。自定义强调色用于选中日期、操作、焦点和日期叶片，按当前背景生成可读的派生色；极亮或极暗选色可能与实际文字色不同，原始选色仍被保存。默认休假、节气、补班和节日沿用五色语义；启用高级配色后只编辑背景、文字、强调色和四个语义主色，悬停、按下、浅底、边框、次要文字和月外日期统一派生；原始主色保留，实际文字按背景校正对比度。切换预设会恢复该预设的强调色，保留高级选色；关闭高级配色可回到基础主题。旧版设置自动补齐清爽白主题且不启用高级配色。详见[配色与文字层级](docs/配色与文字层级.md)和[主题模型](docs/主题模型.md)。

## 品牌与图标

Logo 以小写 `i` 为主体：蓝色圆角底承载白色日历纸，中央圆点与短竖组成 `i`，顶部双装订缺口提示日历。固定品牌蓝为 `#3269d9`；主题与用户强调色继续作用于界面操作，Logo 保持品牌色。菜单栏使用透明底单色模板，由 macOS 适配明暗背景。

唯一彩色矢量源为 [`packages/calendar-ui/src/assets/logo.svg`](packages/calendar-ui/src/assets/logo.svg)，共享界面直接引用；菜单栏源为 [`tray.svg`](apps/calendar/src-tauri/icons/tray.svg)。修改后，在 macOS 安装 librsvg（提供 `rsvg-convert`），执行：

```sh
pnpm run build:icons
```

脚本使用 `rsvg-convert` 与系统 `iconutil` 生成网页 favicon、Mac PNG/ICNS 及菜单栏 PNG；Mac 图标留出系统边距，通用 1024px PNG 铺满底色以供后续 iOS 图标接入。中间文件写入 `work/brand/`，PNG 记录矢量来源。普通构建使用已提交图标，无需重新生成。iOS 图标资源目录、工程编译和设备验证仍需后续 Xcode 环境完成。

[品牌与小尺寸预览](docs/images/i日历-品牌预览.png) · [新版宽屏界面](docs/images/i日历-宽屏.png) · [新版手机尺寸界面](docs/images/i日历-手机.png)。其余文档中的旧截图保留为各阶段记录。

## 调休数据与缓存

内置数据来自 holiday-cn，保留年度官方通知来源。仅在点击“检查调休更新”时请求本年及次年 JSON，失败继续使用内置或缓存数据。导入前验证大小、结构、日期、年份、来源 URL 和重复日期；格式校验不能自动证明一份年度安排完整可信。

Mac 设置和调休缓存保存于 `~/Library/Application Support/local.icalendar.app/calendar-state.json`，采用临时文件及原子替换。新文件缺失时，先只读迁移 `Application Support/local.shiri.calendar/calendar-state.json` 中的完整状态，再回退到早期 `Application Support/ShiriCalendar/holidays.json` 及 `local.shiri.calendar` 偏好；首次成功保存后写入新位置，旧文件保留。已存在但损坏的新文件不会被旧数据静默替代。iOS 使用应用沙盒；Web 在当前站点的 localStorage 使用 `i-calendar:state:v1`，缺失时只读迁移 `shiri-calendar:state:v1`，后续保存使用新键。三端不自动同步。

```sh
pnpm run data:fetch 2028  # 只暂存到 work/holiday-staging，不替换发布数据
```

维护者核对官方通知、跨年日期、放假及补班后，再更新 `packages/calendar-core/src/data/`、数据入口和对应测试。日期按北京时间计算，范围不包含个人排班和地方假期。

项目介绍、用户文案、版本与提交描述使用中文，每个验证后的逻辑修改立即提交。协作规则见 [AGENTS.md](AGENTS.md)。项目自身采用 [MIT 许可证](LICENSE)；第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，构建会在应用和网页中附带项目主许可证及依赖许可证。

## 黄历数据

公共核心提供独立的 `getAlmanac('2026-12-01')`，返回普通可序列化数据，不依赖界面或联网。年月日干支、完整宜忌、冲煞及喜神、福神、财神、阴阳贵神方位均来自锁定的 lunar-typescript 1.8.7。

查询口径固定为：干支年按正月初一换年，月按节交接日零点换月，日按北京时间零点换日；宜忌和福神使用流派 1。本轮未包含时辰。核心结果携带规则标识、库版本和文档链接，查询口径在项目文档中说明。传统宜忌存在流派差异，不承诺与百度等网站逐项相同，上游“无”保留原文。详见[黄历数据与口径](docs/黄历数据与口径.md)及[公共 API](packages/calendar-core/README.md)。

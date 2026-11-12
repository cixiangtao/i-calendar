# 拾日历

Mac 菜单栏里的小月历，提供公历、农历、传统节日、节气、放假与补班，以及年月日干支、每日宜忌、冲煞和主要方位。免费、无广告，无需登录。

当前版本 **0.1.0**。项目已迁移为 **Tauri 2 + React + TypeScript**：Mac、iOS 和 Web 复用同一份界面、应用状态和日历核心。Mac 菜单栏应用与本地网页版已可运行；iOS 的入口及配置已接入，工程生成、模拟器和真机验证仍需完整 Xcode 环境。

项目达到 **1.0** 并完成验收后，再提交 GitHub，并同步上线网页版官网。目前只在本地 Git 管理，没有提前发布。官网第一屏只有日历与必要操作，介绍和下载放在首屏之后。见[版本规划](docs/版本规划.md)与[发布约定](docs/发布约定.md)。

## 快速启动

在项目目录 `/Users/xbb/Desktop/@anys/shiri-calendar` 执行：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run dev:mac
```

项目固定使用 pnpm 12.18.0，由 Corepack 按 `packageManager` 选择版本。以下 `pnpm` 命令均使用该版本，也可统一写成 `corepack pnpm …`。工作区使用 `pnpm-workspace.yaml`，JavaScript 依赖锁文件为 `pnpm-lock.yaml`。

Mac 开发需要 Node 24+、macOS 13+、Command Line Tools 和通过 rustup 安装的 Rust。项目在 `rust-toolchain.toml` 中锁定 Rust 1.99.1，不修改系统全局默认工具链。首次运行会下载和编译 Rust 依赖，耗时比后续启动长。`dev:mac` 会自动启动前端服务，再打开菜单栏日历。

只看网页版不需要 Rust：

```sh
pnpm run dev:web
```

打开终端显示的地址，默认是 <http://127.0.0.1:1420/>。Mac 开发和 Web 开发共用此端口，请勿同时启动两个开发服务。

## Mac 应用

```sh
pnpm run build:mac
open outputs/mac/拾日历.app
```

产物为 `outputs/mac/拾日历.app` 和 `outputs/拾日历-0.1.0-mac-arm64.zip`（文件名随本机构架变化）。当前验证环境为 Apple Silicon；应用采用本地临时签名，没有 Developer ID 签名或 Apple 公证，尚不是正式分发版。

- 左键菜单栏图标展开或收起；失去焦点自动收起；右键可进入设置或退出。
- 点日期查看完整农历和休班状态，点年月直接跳转。
- 干支、完整宜忌、冲煞和方位直接展示在所选日期下方；宽窄屏内容一致。Mac 下方详情及宽屏网页右栏可独立滚动，无需进入另一页。
- 方向键选日，PageUp / PageDown 切月，T 回到今天，Esc 返回或收起。
- 设置支持周一/周日开始、跟随系统/浅色/深色、手动检查更新与年度 JSON 导入。
- 设置中的“配色”提供清爽白、暖纸色、雾灰蓝三套主题，可自定义强调色并恢复默认；本地保存，切换明暗外观后继续生效。
- 日期摘要右键菜单提供“复制日期与农历”，也可查看放假来源。
- 未收录的年份明确显示“调休未收录”，仍可查询农历、节气与黄历。

应用内置计算代码与 2025—2027 年调休快照，正常查询离线运行。网页首次打开需要加载资源；当前未实现 Service Worker 离线重载。

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
pnpm run check          # lint、格式、类型检查、30 项测试及 ESM/网页构建
pnpm run check:native   # Rust 测试：存储、旧数据迁移、多屏定位
pnpm run build:mac      # 构建 Mac 应用、校验签名并生成 ZIP
pnpm run check:mac      # Rust 测试 + 已打包应用的真实 WebView 冒烟验证
pnpm run preview:web   # 预览已构建的静态网页
```

`check:mac` 使用隔离的冒烟实例，跳过偏好与调休缓存读写，可与正在运行的开发窗口并行验证；正常应用继续保持单实例。运行前先构建最新 Mac 应用。验证范围与限制见[验证记录](docs/验证记录.md)。

## 工具链与格式约定

- 使用 oxlint 1.93.0 检查 TypeScript、React、Node 和无障碍规则，配置为 `.oxlintrc.json`。
- 使用 oxfmt 0.78.0 统一格式，启用导入排序、package.json 字段及脚本排序、Tailwind 类名排序、JSDoc、嵌入代码格式化和 JSX 单属性分行，配置为 `.oxfmtrc.json`。本轮已执行一次全项目格式化。
- oxfmt 处理其支持的源码、CSS、HTML、JSON、Markdown、YAML 和 TOML。依赖、生成文件、构建缓存、输出目录及 pnpm 锁文件交给相应工具维护；Rust 使用 `cargo fmt`。
- Tailwind CSS 3.4.19 经 PostCSS 接入 Vite，使用 `tw-` 前缀并复用已有主题变量；关闭 Preflight，保留现有基础样式和 Ant Design 行为。选择 3.4 是为了支持当前 macOS 13 / iOS 16；Tailwind 4 要求 Safari 16.4+。
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

界面采用红绿蓝黄紫的状态配色与圆角面板。Mac 维持 400×660 的上下布局，宽屏网页采用月历与日期详情双栏；上述布局预览来自浏览器，手机图不代表 iOS 真机验证。

配色将主要文字、次要说明与相邻月日期分层。自定义强调色用于选中日期、操作、焦点和日期叶片，按当前背景生成可读的派生色；极亮或极暗选色可能与实际文字色不同，原始选色仍被保存。休假、节气、补班和节日的语义色保持稳定。切换预设会恢复该预设的强调色，旧版设置自动补齐清爽白主题。详见[配色与文字层级](docs/配色与文字层级.md)。

## 调休数据与缓存

内置数据来自 holiday-cn，保留年度官方通知来源。仅在点击“检查调休更新”时请求本年及次年 JSON，失败继续使用内置或缓存数据。导入前验证大小、结构、日期、年份、来源 URL 和重复日期；格式校验不能自动证明一份年度安排完整可信。

Mac 设置和调休缓存保存于 `~/Library/Application Support/local.shiri.calendar/calendar-state.json`，采用临时文件及原子替换。缺少新缓存时，只读迁移旧 `Application Support/ShiriCalendar/holidays.json` 及 `local.shiri.calendar` 偏好；首次成功保存后写入新位置，旧文件保留。iOS 使用应用沙盒，Web 使用当前站点的 localStorage，三端不自动同步。

```sh
pnpm run data:fetch 2028  # 只暂存到 work/holiday-staging，不替换发布数据
```

维护者核对官方通知、跨年日期、放假及补班后，再更新 `packages/calendar-core/src/data/`、数据入口和对应测试。日期按北京时间计算，范围不包含个人排班和地方假期。

项目介绍、用户文案、版本与提交描述使用中文，每个验证后的逻辑修改立即提交。协作规则见 [AGENTS.md](AGENTS.md)。第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；构建会在应用和网页中附带依赖许可证。项目自身的正式开源许可证将在 1.0 发布前确定。

## 黄历数据

公共核心提供独立的 `getAlmanac('2026-12-01')`，返回普通可序列化数据，不依赖界面或联网。年月日干支、完整宜忌、冲煞及喜神、福神、财神、阴阳贵神方位均来自锁定的 lunar-typescript 1.8.7。

查询口径固定为：干支年按正月初一换年，月按节交接日零点换月，日按北京时间零点换日；宜忌和福神使用流派 1。本轮未包含时辰。核心结果携带规则标识、库版本和文档链接，查询口径在项目文档中说明。传统宜忌存在流派差异，不承诺与百度等网站逐项相同，上游“无”保留原文。详见[黄历数据与口径](docs/黄历数据与口径.md)及[公共 API](packages/calendar-core/README.md)。

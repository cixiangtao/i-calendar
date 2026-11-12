# 拾日历

Mac 菜单栏里的小月历，提供公历、农历、传统节日、节气、放假与补班。免费、无广告，无需登录。

当前版本 **0.1.0**。项目已迁移为 **Tauri 2 + React + TypeScript**：Mac、iOS 和 Web 复用同一份界面、应用状态和日历核心。Mac 菜单栏应用与本地网页版已可运行；iOS 的入口及配置已接入，工程生成、模拟器和真机验证仍需完整 Xcode 环境。

项目达到 **1.0** 并完成验收后，再提交 GitHub，并同步上线网页版官网。目前只在本地 Git 管理，没有提前发布。官网第一屏只有日历与必要操作，介绍和下载放在首屏之后。见[版本规划](docs/版本规划.md)与[发布约定](docs/发布约定.md)。

## 快速启动

在项目目录 `/Users/xbb/Desktop/@anys/shiri-calendar` 执行：

```sh
npm ci
npm run dev:mac
```

Mac 开发需要 Node 24+、macOS 13+、Command Line Tools 和通过 rustup 安装的 Rust。项目在 `rust-toolchain.toml` 中锁定 Rust 1.99.1，不修改系统全局默认工具链。首次运行会下载和编译 Rust 依赖，耗时比后续启动长。`dev:mac` 会自动启动前端服务，再打开菜单栏日历。

只看网页版不需要 Rust：

```sh
npm run dev:web
```

打开终端显示的地址，默认是 <http://127.0.0.1:1420/>。Mac 开发和 Web 开发共用此端口，请勿同时启动两个开发服务。

## Mac 应用

```sh
npm run build:mac
open outputs/mac/拾日历.app
```

产物为 `outputs/mac/拾日历.app` 和 `outputs/拾日历-0.1.0-mac-arm64.zip`（文件名随本机构架变化）。当前验证环境为 Apple Silicon；应用采用本地临时签名，没有 Developer ID 签名或 Apple 公证，尚不是正式分发版。

- 左键菜单栏图标展开或收起；失去焦点自动收起；右键可进入设置或退出。
- 点日期查看完整农历和休班状态，点年月直接跳转。
- 方向键选日，PageUp / PageDown 切月，T 回到今天，Esc 返回或收起。
- 设置支持周一/周日开始、跟随系统/浅色/深色、手动检查更新与年度 JSON 导入。
- 摘要旁可复制日期，摘要右键菜单可查看放假来源。
- 未收录的年份明确显示“调休未收录”，仍可查询农历和节气。

应用内置计算代码与 2025—2027 年调休快照，正常查询离线运行。网页首次打开需要加载资源；当前未实现 Service Worker 离线重载。

## iOS 接入

需要完整 Xcode、iOS SDK、CocoaPods 和 Apple 开发团队配置。先完成 Xcode 首次启动及所需平台组件安装，然后执行：

```sh
npm run ios:init
npm run dev:ios
# 配置签名与团队后按需构建
npm run build:ios
```

`ios:init` 使用官方 Tauri CLI 生成 `apps/calendar/src-tauri/gen/apple` 中的 Xcode 工程；生成的工程源码应提交，Pods、用户状态和构建缓存不提交。当前机器仅有 Command Line Tools，且缺少 CocoaPods，因此没有生成或交付可验证的 iOS 工程/安装包。共享界面的手机尺寸检查不等于 iOS 模拟器或真机验证。Widget 和系统日历集成尚未实现。

## 检查与构建

```sh
npm run check          # 严格类型检查、20 项核心/状态测试、ESM 与网页构建
npm run check:native   # Rust 测试：存储、旧数据迁移、多屏定位
npm run build:mac      # 构建 Mac 应用、校验签名并生成 ZIP
npm run check:mac      # Rust 测试 + 已打包应用的真实 WebView 冒烟验证
npm run preview:web   # 预览已构建的静态网页
```

`check:mac` 前请退出正在运行的拾日历；单实例保护可能把第二次启动交给现有进程，验证脚本会明确报错，不会据此判定通过。验证范围与限制见[验证记录](docs/验证记录.md)。

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

[桌面网页截图](docs/images/网页桌面.png) · [手机深色截图](docs/images/网页手机深色.png)

## 调休数据与缓存

内置数据来自 holiday-cn，保留年度官方通知来源。仅在点击“检查调休更新”时请求本年及次年 JSON，失败继续使用内置或缓存数据。导入前验证大小、结构、日期、年份、来源 URL 和重复日期；格式校验不能自动证明一份年度安排完整可信。

Mac 设置和调休缓存保存于 `~/Library/Application Support/local.shiri.calendar/calendar-state.json`，采用临时文件及原子替换。缺少新缓存时，只读迁移旧 `Application Support/ShiriCalendar/holidays.json` 及 `local.shiri.calendar` 偏好；首次成功保存后写入新位置，旧文件保留。iOS 使用应用沙盒，Web 使用当前站点的 localStorage，三端不自动同步。

```sh
npm run data:fetch -- 2028  # 只暂存到 work/holiday-staging，不替换发布数据
```

维护者核对官方通知、跨年日期、放假及补班后，再更新 `packages/calendar-core/src/data/`、数据入口和对应测试。日期按北京时间计算，范围不包含个人排班和地方假期。

项目介绍、用户文案、版本与提交描述使用中文，每个验证后的逻辑修改立即提交。协作规则见 [AGENTS.md](AGENTS.md)。第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；构建会在应用和网页中附带依赖许可证。项目自身的正式开源许可证将在 1.0 发布前确定。

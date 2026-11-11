# 拾日历

Mac 菜单栏小日历：公历、农历、传统节日、节气、放假与补班。免费、无广告，正常查询完全离线。

项目名为“拾日历”，仓库名为 `shiri-calendar`。第一版仅做 Mac 菜单栏弹层。原生 SwiftUI 界面，独立 TypeScript 核心；Mac 和 iOS 经 JavaScriptCore 使用同一份本地计算代码，Web 可以直接使用 npm 包。当前版本为 **0.1.0**，已提供 Mac 应用、Apple 共享 Swift 包与 ESM 核心；iOS 界面与网页版尚未实现。

项目达到 **1.0** 并完成验收后，再提交 GitHub，并同步上线网页版官网。官网打开后第一屏即可使用日历，下载与项目说明放在首屏之后或次级入口。具体安排见[版本规划](docs/版本规划.md)与[发布约定](docs/发布约定.md)。

## 项目协作

源码位于 `/Users/xbb/Desktop/@anys/shiri-calendar`。项目介绍、用户文案、文档、版本说明及提交描述统一使用中文。每完成一个经过验证的逻辑修改，立即提交一次 commit；协作规则见 [AGENTS.md](AGENTS.md)。

## 运行

双击 `outputs/mac/拾日历.app`，点击菜单栏日历图标即可打开。没有 Dock 主窗口。

- 点击日期查看农历与休班信息；点击底部的节气/假期可以跳到对应日期。
- 左右箭头切月，`T` 回到今天，`Esc` 收起。
- 点击年月可选择年份、月份。
- 设置支持周一/周日开始、跟随系统/浅色/深色、手动更新和导入年度调休数据。
- 右键日期摘要可复制日期、查看官方放假来源；右键菜单栏图标可以退出。
- 调休未收录的年份会明确显示未知状态，农历和节气仍然可查。

当前交付为 Apple Silicon macOS 13+ 本机开发版，做了 ad-hoc 签名，没有 Developer ID 签名与 Apple 公证，不是 App Store 安装包。

## 构建

需要 Node 24+、macOS 13+ 与 Swift 5.9+。Mac 构建可使用 Command Line Tools，iOS 应用集成与模拟器需要完整 Xcode。

```sh
npm ci
npm run check         # 核心类型检查、测试和跨平台构建
npm run check:apple   # 在真实 JavaScriptCore 上运行桥接验证（无需 XCTest）
npm run build:mac     # release 构建 .app、ad-hoc 签名及 ZIP
```

原生视图和导航状态可通过构建后的可执行文件验证：

```sh
swift run --package-path platforms/apple ShiriCalendar --snapshot-test work/snapshots
outputs/mac/拾日历.app/Contents/MacOS/ShiriCalendar --lifecycle-test
```

快照测试使用隔离偏好及固定日期，显示实际 SwiftUI/AppKit 视图后捕获，避免离屏缓存丢字。生命周期测试实际打开、关闭、重新打开 NSPopover 并退出；不覆盖真实鼠标、Esc、VoiceOver 和 iOS 真机操作。

## 目录与依赖边界

```text
packages/calendar-core/          公共数据引擎：日期、农历、节日、节气、调休
  src/data/                     2025—2027 年可追溯调休快照
platforms/apple/
  Sources/ShiriCalendarKit/     macOS/iOS 共享的 Swift 桥接包和 Codable 类型
  Sources/ShiriCalendar/        Mac 菜单栏与 SwiftUI 界面
  Sources/CalendarSmoke/        原生桥接验证程序
scripts/                       构建、打包、图标和调休数据暂存工具
outputs/                       本机 .app、ZIP 与效果图
```

[浅色界面](docs/images/日历浅色.png) · [深色界面](docs/images/日历深色.png) · [春节休班](docs/images/春节休班.png)

依赖方向：SwiftUI → ShiriCalendarKit → 已打包的 calendar-core。Web → calendar-core。核心不感知任何界面或平台，不做网络请求。

## 调休数据维护

内置 2025—2027 年数据来自 holiday-cn，保留每年官方通知来源。应用设置里的“检查调休更新”仅在用户点击时下载本年及次年 JSON，失败继续使用内置/缓存数据；从未自动运行、从未请求用户日程。

缓存位于系统 Application Support/ShiriCalendar/holidays.json。导入前验证格式、日期、年份、来源 URL 和重复日期。年度文件完整性及其政策含义无法仅凭 JSON 验证；维护者应按官方通知核对，不应导入仅有占位内容的未来年份文件。

维护内置快照：

```sh
npm run data:fetch -- 2028  # 只下载到 work/holiday-staging，不替换已发布数据
```

核对公告、跨年日期、休假和补班后，将完整年度 JSON 加入 `packages/calendar-core/src/data/`，更新 `src/data.ts`，补上对应官方样例测试，再重新构建。计算与显示采用北京时间；范围不包含个人排班和地方假期。

## iOS 与 Web

iOS 工程可将 `platforms/apple` 作为本地 Swift Package，仅选择 `ShiriCalendarKit` 产品；该产品不依赖 AppKit 或 Mac 界面。业务层 `@MainActor` 创建 `CalendarService` 并调用 `getDay/getMonth/getUpcoming/getVacations`。已在 macOS JavaScriptCore 上验证，当前未在 iOS 设备/模拟器验证。

Web 工程直接引用 `@shiri/calendar-core`，按需引入 `@shiri/calendar-core/data` 内置调休数据。不需要 JavaScriptCore 或服务端。详细契约见 `packages/calendar-core/README.md`。

第三方许可全文见 `THIRD_PARTY_NOTICES.md`。

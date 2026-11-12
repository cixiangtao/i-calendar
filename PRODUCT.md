# 拾日历

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

目标平台为 macOS 与 iOS；1.0 发布时同步上线网页版官网。使用 Tauri 2 + React + TypeScript，开发工具链为 pnpm、oxlint、oxfmt 与 Tailwind CSS；Mac、iOS 与 Web 共用界面、应用状态和独立日历核心。Mac 与 Web 已运行验证；iOS 配置和入口已接入，完整工程生成及设备验证仍需 Xcode 环境。

## Users

需要农历、传统节日和中国大陆放假调休信息的 Mac 用户。

## Product Purpose

免费、没有广告、随手打开即可查日子。

## Operating Context

Mac 第一版只做菜单栏弹出小日历，无 Dock 主窗口。用户常用百度日历；该事实说明使用背景，不代表要求复刻其样式。

## Capabilities and Constraints

- 核心数据能力与 UI 分离，跨平台复用。
- 第一版以月历、公农历、节气、节日、休假与补班为范围。
- 支持离线查询，年度调休数据可更新；缺失数据须明确表达。
- iOS 是后续目标，当前先完善 Mac；网页版官网在 1.0 时同步发布。
- 用户先看视觉效果图，已选择 A 月历优先方案。
- 不包含账户、广告、日程协作或宜忌黄历。

## Brand Commitments

项目名为“拾日历”，仓库与目录名为 `shiri-calendar`。项目介绍、文档、用户界面和提交描述使用中文。

## Evidence on Hand

`lunar-typescript` 1.8.7 用于本地计算；`holiday-cn` 2025—2027 年数据快照携带官方来源。2027 年安排已与政府网站转载的国务院通知交叉核对。

## Product Principles

1. 查日期比功能堆叠更重要。
2. 同一套核心规则服务所有目标平台。
3. 信息可靠且可追溯，未知状态不伪装成已知。
4. 菜单栏交互适配系统，日历与已收录数据离线可用。

## 发布与官网

当前版本为 0.1.0；达到 1.0 并完成验收后，再提交 GitHub 并同步上线网页版官网。官网首屏只保留可直接使用的日历与必要操作；下载和项目说明放在首屏之后或次级入口。每个完成并验证的逻辑修改均提交中文 commit。

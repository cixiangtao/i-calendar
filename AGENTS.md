# 拾日历项目协作约定

## 沟通与语言

- 称呼用户为“IKUN同学”，思考、交流和回复使用中文。
- 项目名称：拾日历；仓库与目录名：`shiri-calendar`。
- README、项目介绍、用户文案、版本说明、发布说明以及 commit 描述使用中文。
- 程序标识符、标准 API、包名和工具结构字段保持技术规范要求的形式。

## 工作目录

- 项目唯一源码目录为 `/Users/xbb/Desktop/@anys/shiri-calendar`；在此目录执行开发、检查和 Git 操作。
- 不再在最初生成的 Codex 临时目录中继续维护另一套源码。
- 中间文件放在 `work/`，本机构建与分发文件放在 `outputs/`，两者不提交 Git。

## 修改与提交

- 每完成一个逻辑完整且经过相应验证的修改，立即创建 commit，不将已完成修改长期留在工作区。
- 一次提交只表达一个明确目的；独立的功能、修复和文档修改分别提交。
- 提交前检查完整差异，说明本轮提交的数量及各自范围，按范围暂存。
- 使用 Conventional Commits，描述用中文，格式为 `type(scope): 对应表情 中文描述`。
- 功能修改执行适用的类型检查、测试和构建；纯文档修改检查内容与链接即可。
- 公共核心修改后运行 `pnpm run build`，验证 ESM 与共享前端构建；涉及原生行为时运行 `pnpm run check:native`、`pnpm run build:mac` 和 `pnpm run check:mac`。`dist/`、`target/` 等构建目录不跟踪。
- 任务结束报告提交记录和验证结果，并确认工作区状态。

## 产品与架构

- 免费、无广告，以查日期、农历、节气和国内放假调休为核心。
- Mac 第一阶段只做菜单栏弹出小日历，沿用用户已选的 A“月历优先”方案。视觉采用用户确认的红绿蓝黄紫基色与圆润简洁风格；Mac 保持紧凑上下布局，宽屏 Web 使用月历＋详情双栏。
- 目标平台为 Mac 与 iOS；网页版在 1.0 发布时同步作为官网提供。
- 公共数据能力放在 `packages/calendar-core`，不依赖界面、网络、文件系统或平台壳。
- Mac 与 iOS 使用 Tauri 2，三端复用 `packages/calendar-ui` 中的 React 视图和应用状态。平台存储、网络与系统能力通过注入接口分离；不重新引入 SwiftUI/JavaScriptCore 桥接或另一套历法算法。
- 休假、补班与常规周末分开处理；未收录的年度调休不得伪装成确定安排。

## 版本与 GitHub 发布

- 当前版本为 0.1.0，不为触发发布而提前改成 1.0。
- 用户已授权：项目达到 1.0 并完成验收后，提交到 GitHub，并同步上线网页版官网。
- 1.0 之前保持本地 Git 管理；不提前创建或推送 GitHub 仓库，不提前发布官网。
- 版本发布按照 `docs/版本规划.md` 和 `docs/发布约定.md` 执行；1.0 前确定仓库归属、许可证与正式部署配置。
- 发布时项目介绍、README、版本说明和 Release Notes 使用中文。

## 官网约定

- 官网同时是可直接使用的网页版日历，访问后即可查日期。
- 首屏只承载日历及必要操作：月份切换、回到今天、公农历、节气、节日与休班信息。
- 应用下载、项目介绍、数据来源与其他说明放到首屏之后或次级入口。
- 保持结构简洁、无广告，复用公共核心；兼顾桌面与手机浏览。

## 工具链与格式

- 统一使用 pnpm 12.18.0，遵循根 `packageManager` 与 `pnpm-workspace.yaml`，通过 Corepack 选择锁定版本。只提交 `pnpm-lock.yaml`，不生成其他 JavaScript 包管理器锁文件。
- JavaScript/TypeScript 使用 oxlint；提交前执行 `pnpm run lint`，不要为消除警告随意扩大规则豁免。
- 使用 oxfmt 格式化其支持的文件，保留导入、package.json、Tailwind 类名、JSDoc 和嵌入代码格式化；提交前执行 `pnpm run format:check`。
- Tailwind 使用 `tw-` 前缀，配置位于 `tailwind.config.ts`，通过 PostCSS/Vite 构建。保持现有最低平台兼容性，保留 Preflight 关闭设置。
- Rust 使用 `cargo fmt`。依赖锁文件、生成资源、`work/` 和 `outputs/` 不手工格式化。

## 常用检查

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run check:native
pnpm run build:mac
pnpm run check:mac
```

`check:mac` 使用已打包的真实 WKWebView 应用验证前端、共享核心、IPC 与窗口生命周期，隔离冒烟模式跳过偏好与调休缓存读写，可与现有开发实例并行验证，正常应用仍保持单实例。iOS 通过 `pnpm run ios:init`、`pnpm run dev:ios` 和 `pnpm run build:ios` 接入；没有完整 Xcode/iOS SDK 时不宣称已编译 iOS、运行模拟器或完成真机验证。

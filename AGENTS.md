# i日历项目协作约定

## 沟通与语言

- 称呼用户为“IKUN同学”，思考、交流和回复使用中文。
- 项目名称：i日历（原名拾日历）；仓库与目录名：`i-calendar`。
- README、项目介绍、用户文案、版本说明、发布说明以及 commit 描述使用中文。
- 程序标识符、标准 API、包名和工具结构字段保持技术规范要求的形式。
- 内部根包和 Rust 程序统一为 `i-calendar`，共享包为 `@i-calendar/core`、`@i-calendar/ui`，应用标识为 `local.icalendar.app`。旧名称仅保留于只读迁移、相关测试与历史记录，不再用于新数据写入或当前构建。

## 工作目录

- 项目唯一源码目录为 `/Users/xbb/Desktop/@anys/i-calendar`；在此目录执行开发、检查和 Git 操作。
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
- 传统黄历通过公共核心 `getAlmanac` 查询，保持来源、库版本和规则可追溯；年按春节、月按节交接日零点、日按北京时间零点，宜忌及福神固定流派 1。变更口径须更新规则版本、边界测试和说明；上游“无”不改写为“诸事皆宜”。
- 基础交互使用 Radix Primitives，并封装为共享 UI 的 `CalendarButton`、`CalendarSelect`、`CalendarSwitch`、`CalendarInput`、`CalendarSegmented`、`CalendarTabs` 和 `CalendarContextMenu` 等组件；业务视图不直接依赖底层库，不重新引入 Ant Design。普通布局、间距、排版、状态和响应式使用带 `tw-` 前缀的 Tailwind；全局 CSS 仅保留主题变量、少量复合状态、伪元素、动画和系统偏好规则。
- 同一组件跨端优先使用统一视觉样式，响应式主要调整结构。月份工具栏统一字号、图标、底色和圆角；触控仅扩大透明点击区域，不另行放大可见控件。
- 品牌 Logo 以小写 `i` 与日历纸为原型，彩色源为共享 UI 的 `assets/logo.svg`，固定品牌蓝 `#3269d9`；菜单栏用透明底单色模板。图标修改后执行 `pnpm run build:icons`，不分别手改各平台位图。
- 配色主数据位于共享 UI 的 `theme-package.ts`，只定义页面背景、卡片背景、文字、强调色与红绿黄紫八个主色；`color-theme.ts` 统一派生文字层级、交互状态、浅底、边框及月外颜色，首帧 CSS 也调用同一规则，不维护另一份派生色表。主题包格式与派生规则分别版本化；高级设置只编辑主色，旧版完整配色载入时保留主色、忽略旧派生色，后续保存只写主色。文字按背景校正对比度，恢复入口保持可读，品牌图标保持原色。

## 版本与 GitHub 发布

- 2026-11-16 起，用户授权每轮项目改动验证通过后直接发布正式版，不再单独询问发布许可；同轮多个必要 commit 合并为一版交付，按实际范围递增版本。用户明确要求只读或暂不发布时，以该轮指令为准。发布后的验收记录属于同次交付，不递归触发下一版。
- 当前版本为 1.0.4。2026-11-13 用户明确要求直接发布正式版，覆盖此前候选版及长期验收后才发布的门槛。
- 发布到 `cixiangtao/i-calendar` 公开仓库，项目主许可证为 MIT；同步发布 GitHub Release、Mac 下载及 GitHub Pages 官网。
- 首发 Mac 为 arm64、本地 ad-hoc 签名、未通过 Apple 公证，必须明确披露。长期驻留、真实登录、最低系统与手机真机等未完成项继续如实记录，不宣称已通过。
- 正式发布由 GitHub Actions 单一入口执行；本地负责校验、提交与明确的版本标签推送。更新私钥只存仓库外受保护目录及 GitHub Secret，公钥与地址位于 `release/config.json`。
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

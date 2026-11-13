# 第三方组件与数据

本应用本地运行，无账户、广告或遥测。用户手动点击“检查调休更新”时，会请求 holiday-cn 的 GitHub 静态数据。

## lunar-typescript 1.8.7

- 作者：6tail
- 代码：https://github.com/6tail/lunar-typescript
- 许可：MIT，全文位于 packages/calendar-core/LICENSE-lunar-typescript。
- 干支、宜忌和方位 API 说明分别见 https://6tail.cn/calendar/lunar.ganzhi.html 、https://6tail.cn/calendar/lunar.yiji.html 和 https://6tail.cn/calendar/lunar.jishen.html 。上游说明宜忌来自对 2345 日历多年资料的整理归纳，各黄历流派可能存在差异；应用固定口径见 [黄历数据与口径](docs/黄历数据与口径.md)。

## holiday-cn

- 作者：NateScarlet 及贡献者
- 项目：https://github.com/NateScarlet/holiday-cn
- 许可：MIT，全文位于 packages/calendar-core/src/data/LICENSE-holiday-cn。
- 内置快照：2025、2026、2027 年，获取日期 2026-11-11。
- 各年度数据的 papers 字段保存国务院通知链接。放假调休为全国统一安排，不代表所有单位或个人的实际排班。
- 2027 年交叉核对参考：https://chinajob.mohrss.gov.cn/h5/c/2026-11-09/635850.shtml

## 界面与应用运行组件

界面使用 React 19.3.1、React DOM 19.3.1 与 Radix Primitives（MIT）：Select 2.4.1、Switch 1.4.1、Tabs 1.2.1、Context Menu 2.4.1、Radio Group 1.5.1。原生壳使用 Tauri 2 及 opener、clipboard-manager、single-instance、updater、autostart 插件（MIT / Apache-2.0，具体以锁定依赖为准）。开发工具包括 pnpm、oxlint、oxfmt、Tailwind CSS、PostCSS、Autoprefixer、Vite、TypeScript、esbuild 与 Rust 工具链。

`pnpm run build:web` 会汇总实际前端依赖随附的许可证，在网页首屏后的入口提供 `third-party-licenses.txt`。原生构建另外根据 Cargo.lock 对应元数据汇总 Rust 组件与构建依赖的许可文件，随应用资源附带 `第三方许可证.txt`。生成文件与编译缓存不提交，构建时重新生成。

项目自身的开源许可证尚未确定，将在 1.0 发布前确认；上述第三方许可证不代表项目自身已采用同一许可。

## MIT 许可全文（lunar-typescript）

MIT License

Copyright (c) 2020 6tail

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## MIT 许可全文（holiday-cn）

MIT License

Copyright (c) 2019 NateScarlet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Tailwind CSS 3.4.19

Tailwind 工具类在构建时生成并随前端分发，采用 MIT 许可，项目地址：https://github.com/tailwindlabs/tailwindcss。

```text
MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

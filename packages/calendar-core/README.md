# @shiri/calendar-core

平台与 UI 无关的中国日历核心。无网络、文件系统、DOM、React 或 Tauri 依赖。输出为可序列化的普通数据。

## 使用

```ts
import { CalendarEngine, HolidayStore } from '@shiri/calendar-core';
import { bundledHolidayDatasets } from '@shiri/calendar-core/data';

const holidays = new HolidayStore(bundledHolidayDatasets);
const calendar = new CalendarEngine(holidays);

calendar.getDay('2026-11-11');
calendar.getMonth(2026, 11); // 周一开始，42 个单元格
calendar.getUpcoming('2026-11-11', { kind: 'solar-term', limit: 3 });
calendar.getVacations('2026-11-11', 3);
```

## 约定

- 日期输入为严格的 `YYYY-MM-DD` 公历民用日期，不是时间戳；支持 1901—2100 年。
- 农历与节气遵循中国历法的 UTC+8 口径；当前日期用 `dateForInstant(instant, 'Asia/Shanghai')` 显式转换。按其他地区日期查询时，调用方自行选择当地日期。
- `weekday` 是 ISO 星期，周一 1、周日 7。
- 农历 `month` 始终为正整数；闰月单独由 `isLeapMonth` 表示。
- 常见节日是产品维护的规则集，并非所有地方/民族/纪念日的完整百科。传统节日不在闰月重复。除夕按年界判断，兼容腊月廿九。
- `schedule.coverage === 'unavailable'` 表示未安装该年完整调休数据。此时 weekday/weekend 只说明常规星期分布，不能用于判断最终上班/放假。
- 普通周末不标成官方假日；明确的周末补班优先。假期查询会将与官方假日相邻的普通周末合并。
- `HolidayStore.import()` 只验证结构和日期，无法证明一个文件完整或来源可信。适配器必须审核年度通知后再将其视为完整年份。临时下载尚未发布的预填文件不可直接收录。
- 同一日期被跨年通知覆盖时，较晚通知年份优先。
- 本包不执行持久化、请求、用户设置或个人排班；这些能力由适配器注入。

## 分发

`npm run build:core` 生成 ESM 与 TypeScript 声明；`npm pack --workspace @shiri/calendar-core` 生成可安装包，尚未发布至公共 npm。

Mac、iOS 与 Web 均由共享 TypeScript 应用状态直接调用本包；Apple 平台通过 Tauri 的系统 WebView 加载相同前端，不再使用 Swift 或 JavaScriptCore 桥接。独立客户端也可只引入 ESM 核心，无需依赖共享 UI。每次构建先清理旧产物，避免分发残留声明。

## 许可与校验

底层 lunar-typescript 和 holiday-cn 采用 MIT 许可，许可副本随包保留。当前年份跨度是产品支持范围，不代表所有年份都已经逐日与天文台数据穷举比对。测试覆盖已知历法边界、输入校验、数据更新、序列化隔离和官方调休样例。

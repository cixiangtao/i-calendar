# @i-calendar/core

平台与 UI 无关的中国日历核心。无网络、文件系统、DOM、React 或 Tauri 依赖。输出为可序列化的普通数据。

## 使用

```ts
import { CalendarEngine, HolidayStore } from '@i-calendar/core';
import { bundledHolidayDatasets } from '@i-calendar/core/data';

const holidays = new HolidayStore(bundledHolidayDatasets);
const calendar = new CalendarEngine(holidays);

calendar.getDay('2026-11-11');
calendar.getDay('2026-11-12').lunar.zodiac; // '马'，农历年生肖
calendar.getDay('2026-11-12').constellation; // '天蝎座'，公历月日固定区间
calendar.getMonth(2026, 11); // 周一开始，42 个单元格
calendar.getUpcoming('2026-11-11', { kind: 'solar-term', limit: 3 });
calendar.getVacations('2026-11-11', 3);
calendar.getAlmanac('2026-12-01'); // 独立查询，不让 42 格月历携带大字段
```

## 约定

- 日期输入为严格的 `YYYY-MM-DD` 公历民用日期，不是时间戳；支持 1901—2100 年。
- 农历与节气遵循中国历法的 UTC+8 口径；当前日期用 `dateForInstant(instant, 'Asia/Shanghai')` 显式转换。按其他地区日期查询时，调用方自行选择当地日期。
- `weekday` 是 ISO 星期，周一 1、周日 7。
- 农历 `month` 始终为正整数；闰月单独由 `isLeapMonth` 表示。
- `lunar.zodiac` 为农历年生肖，按正月初一换年，不按元旦或立春；`constellation` 为带“座”后缀的公历星座，沿用 lunar-typescript 1.8.7 的 `Solar.getXingZuo()` 固定月日区间，不涉及出生时刻推算。两者独立于调休覆盖状态。
- 常见节日是产品维护的规则集，并非所有地方/民族/纪念日的完整百科。传统节日不在闰月重复。除夕按年界判断，兼容腊月廿九。
- `schedule.coverage === 'unavailable'` 表示未安装该年完整调休数据。此时 weekday/weekend 只说明常规星期分布，不能用于判断最终上班/放假。
- 普通周末不标成官方假日；明确的周末补班优先。假期查询会将与官方假日相邻的普通周末合并。
- `HolidayStore.import()` 只验证结构和日期，无法证明一个文件完整或来源可信。适配器必须审核年度通知后再将其视为完整年份。临时下载尚未发布的预填文件不可直接收录。
- 同一日期被跨年通知覆盖时，较晚通知年份优先。
- 本包不执行持久化、请求、用户设置或个人排班；这些能力由适配器注入。

## 每日黄历 API

```ts
import { getAlmanac } from '@i-calendar/core';

const value = getAlmanac('2026-12-01');
value.ganZhi; // { year: '丙午', month: '己亥', day: '己酉' }
value.yi; // 完整宜事项数组，本日 21 项
value.ji; // ['移徙', '入宅', '出火', '入殓', '安葬']
value.chong; // '(癸卯)兔'
value.sha; // '东'
value.positions.fu; // '正南'
value.rules.id; // 'i-calendar-almanac-v1'
value.source.version; // '1.8.7'
```

函数及 `CalendarEngine.getAlmanac` 返回同一 `DayAlmanac` 契约：日期、三柱干支、完整宜忌、冲煞、喜/福/财神及阴阳贵神方位、规则与来源元信息。每次返回独立普通对象和数组，可 JSON 序列化；不需要 HolidayStore 数据或网络，也不暴露上游实例。日期格式或范围无效时抛错，与 `getDay` 使用相同日期校验。

固定口径为春节换年、节交接日零点换月、北京时间零点换日；宜忌和福神显式使用流派 1。上游“无”原样保留，不能解释为“诸事皆宜”。本轮是日期查询，不推导时柱或晚子时；规则变化须更新 `rules.id`、边界测试和文档。来源版本与实际锁定依赖有一致性测试。详见[黄历数据与口径](../../docs/黄历数据与口径.md)。

## 分发

在项目根目录执行 `pnpm run build:core` 生成 ESM 与 TypeScript 声明；`pnpm --filter @i-calendar/core pack --pack-destination "$PWD/outputs"` 生成可安装包，尚未发布至公共 npm。

Mac、iOS 与 Web 均由共享 TypeScript 应用状态直接调用本包；Apple 平台通过 Tauri 的系统 WebView 加载相同前端，不再使用 Swift 或 JavaScriptCore 桥接。独立客户端也可只引入 ESM 核心，无需依赖共享 UI。每次构建先清理旧产物，避免分发残留声明。

## 许可与校验

底层 lunar-typescript 和 holiday-cn 采用 MIT 许可，许可副本随包保留。当前年份跨度是产品支持范围，不代表所有年份都已经逐日与天文台数据穷举比对。测试覆盖已知历法边界、输入校验、数据更新、序列化隔离和官方调休样例。

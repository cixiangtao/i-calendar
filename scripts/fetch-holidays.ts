import { mkdir, writeFile } from 'node:fs/promises';
import { parseHolidayDataset } from '../packages/calendar-core/src/holidays.js';

// Download into staging for review; never replace the shipping snapshot implicitly.
const years = process.argv.slice(2).map(Number);
if (years.length === 0 || years.some((year) => !Number.isInteger(year) || year < 1901 || year > 2100)) {
  throw new Error('用法：npm run data:fetch -- 2028（下载到 work/holiday-staging，核对官方通知后再收录）');
}
await mkdir('work/holiday-staging', { recursive: true });
for (const year of years) {
  const response = await fetch(`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${year} 年数据下载失败：HTTP ${response.status}`);
  const dataset = parseHolidayDataset(await response.json());
  if (dataset.year !== year) throw new Error('数据年份与请求不一致');
  await writeFile(`work/holiday-staging/${year}.json`, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`${year}：已暂存 ${dataset.days.length} 个调休条目，需审核来源：${dataset.papers.join('、')}`);
}

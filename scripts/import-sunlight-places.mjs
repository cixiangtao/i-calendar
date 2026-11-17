import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// 手动更新快照：先下载 GeoNames cities15000.zip，再显式传入本地路径；构建不访问网络。
const archive = process.argv[2];
if (!archive) throw new Error('请提供已下载的 cities15000.zip 路径');
const bytes = await readFile(archive);
const raw = execFileSync('unzip', ['-p', archive, 'cities15000.txt'], {
  encoding: 'utf8',
  maxBuffer: 30_000_000,
});
const provinces = {
  '01': '安徽',
  '02': '浙江',
  '03': '江西',
  '04': '江苏',
  '05': '吉林',
  '06': '青海',
  '07': '福建',
  '08': '黑龙江',
  '09': '河南',
  10: '河北',
  11: '湖南',
  12: '湖北',
  13: '新疆',
  14: '西藏',
  15: '甘肃',
  16: '广西',
  18: '贵州',
  19: '辽宁',
  20: '内蒙古',
  21: '宁夏',
  22: '北京',
  23: '上海',
  24: '山西',
  25: '山东',
  26: '陕西',
  28: '天津',
  29: '云南',
  30: '广东',
  31: '海南',
  32: '四川',
  33: '重庆',
};
const places = [];
for (const row of raw.trim().split('\n')) {
  const fields = row.split('\t');
  const region =
    fields[8] === 'CN' ? provinces[fields[10]] : { HK: '香港', MO: '澳门', TW: '台湾' }[fields[8]];
  if (!region) continue;
  const names = fields[3].split(',').filter((name) => /^[\u4e00-\u9fff]{2,12}$/.test(name));
  const name = names.find((candidate) => candidate.endsWith('市')) ?? names[0];
  if (!name) continue;
  places.push({
    id: fields[0],
    name,
    region,
    latitude: Number(fields[4]),
    longitude: Number(fields[5]),
  });
}
places.sort((a, b) => Number(a.id) - Number(b.id));
await writeFile('packages/calendar-core/src/data/china-places.json', JSON.stringify(places) + '\n');
const provenance = {
  source: 'GeoNames',
  url: 'https://download.geonames.org/export/dump/cities15000.zip',
  license: 'CC-BY-4.0',
  retrievedAt: new Date().toISOString().slice(0, 10),
  archiveSha256: createHash('sha256').update(bytes).digest('hex'),
  count: places.length,
  transformation:
    '筛选国内中文地名参考点，保留 GeoNames 标识和 WGS84 坐标；不构成完整行政区划或边界数据。',
};
await writeFile(
  'packages/calendar-core/src/data/china-places-source.json',
  JSON.stringify(provenance, null, 2) + '\n',
);
console.log(`已生成 ${places.length} 个地点参考点。`);

import type { CalendarDay } from '@i-calendar/core';
import { generateFortuneV2 } from 'acer-almanac';

// 签名取自第一条宜对应的短标题，宜忌直接展示上游事项名。
const signTitles: Partial<Record<string, string>> = {
  'plan-the-day': '今日留白',
  'report-progress': '三句交代',
  'clear-inbox': '旧信开封',
  'deep-work': '暂不在线',
  'organize-docs': '有案可查',
  'tackle-hard-task': '慢拆难题',
  'project-retrospective': '旧事有用',
  'learn-work-tool': '少点一下',
  'focused-reading': '书签向前',
  'learn-words': '生词出门',
  'practice-exercises': '旧题重逢',
  'watch-course': '课间实习',
  'review-notes': '笔记返场',
  'learn-new-skill': '新手当值',
  'write-summary': '留张字条',
  'ask-question': '问号开口',
  'sleep-early': '提前打烊',
  'morning-stretch': '松松筋骨',
  'strength-training': '留把力气',
  'easy-run': '慢跑一站',
  'balanced-meal': '头口归己',
  'drink-water': '杯中有余',
  'rest-eyes': '借一点远景',
  'health-check': '旧单归档',
  'contact-friend': '忽然想起',
  'say-thanks': '迟到回执',
  'listen-carefully': '半拍之后',
  'team-conversation': '说清下回',
  'meet-someone': '从这儿聊',
  'family-time': '旧事开桌',
  'make-peace': '撤回重说',
  'share-good-news': '小喜报',
  'clean-room': '桌面停靠',
  'organize-wardrobe': '旧衣上场',
  'cook-meal': '热饭现做',
  'small-repair': '小物复职',
  'care-plants': '盆栽朝阳',
  'do-laundry': '新鲜换班',
  'review-budget': '购物车冷静期',
  declutter: '闲物下一站',
  'take-walk': '顺路绕一圈',
  'go-hiking': '山路小歇',
  'ride-bike': '途中可停',
  'watch-sunset': '黄昏有席',
  'park-break': '长椅有空',
  'city-walk': '换边经过',
  'take-photos': '一小片光',
  'have-picnic': '点心出门',
  'write-something': '今天有旁白',
  'draw-picture': '杯子入画',
  'practice-instrument': '半拍慢练',
  'make-craft': '纸角余生',
  'shoot-video': '小事登场',
  brainstorm: '离谱有位',
  'design-solution': '另画一笔',
  'collect-ideas': '偶然碰面',
  'watch-anime': '下一集见',
  'watch-movie': '今晚放映',
  'play-game': '存档还在',
  'listen-podcast': '路上有声',
  'build-model': '零件归位',
  'see-performance': '现场有座',
  'read-comics': '停在这一格',
  'play-with-pet': '它来选',
};

/** 用当天日期和本地抽签种子计算签面，签等由 acer 的完整宜忌条目数决定。 */
export function createDailySign(day: Pick<CalendarDay, 'year' | 'month' | 'day'>, seed: string) {
  const { good, bad } = generateFortuneV2(day, seed);
  const [lead] = good;
  if (!lead) throw new Error('每日签缺少主签');

  const balance = good.length - bad.length;
  const title = lead.activityId ? signTitles[lead.activityId] : undefined;
  return {
    rank: balance > 0 ? '上签' : balance < 0 ? '下签' : '中签',
    title: title ?? lead.activity,
    good: good.map(({ activity }) => activity),
    bad: bad.map(({ activity }) => activity),
  };
}

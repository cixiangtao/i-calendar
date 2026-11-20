import type { CalendarDay } from '@i-calendar/core';
import { generateFortuneV2, type FortuneItem } from 'acer-almanac';

type SignCopy = readonly [title: string, good: string, bad: string];

// 按 acer-almanac 的活动标识提供签名及宜忌文案，保留上游抽到的事项和顺序。
const signCopy: Partial<Record<string, SignCopy>> = {
  'plan-the-day': ['今日留白', '给日程留一格空白', '把半小时排出一整天的架势'],
  'report-progress': ['三句交代', '用三句话讲清进度', '让汇报长过工作本身'],
  'clear-inbox': ['旧信开封', '回那封压在底下的信', '用未读红点装点桌面'],
  'deep-work': ['暂不在线', '留半小时给手头的事', '每五分钟巡一次聊天框'],
  'organize-docs': ['有案可查', '给文件起个找得到的名', '再存一份最终版之最终版'],
  'tackle-hard-task': ['慢拆难题', '挑最小的一步先试', '把一口咬不下的事硬啃到天黑'],
  'project-retrospective': ['旧事有用', '从旧项目捡回一条经验', '把复盘开成追责大会'],
  'learn-work-tool': ['少点一下', '学一个真用得上的快捷键', '为了省一秒研究一下午'],
  'focused-reading': ['书签向前', '读完书签后面十页', '让手机替书翻页'],
  'learn-words': ['生词出门', '把一个新词用进今天', '背单词背到较劲'],
  'practice-exercises': ['旧题重逢', '重做一道靠运气答对的题', '刷题刷过饭点'],
  'watch-course': ['课间实习', '看一节课就动一下手', '把收藏量算进学习时间'],
  'review-notes': ['笔记返场', '从旧笔记捞回个点子', '花半天给旧笔记换封面'],
  'learn-new-skill': ['新手当值', '当十分钟新手', '第一天就要求自己出师'],
  'write-summary': ['留张字条', '写给下周忘事的自己看', '把总结写成毕业论文'],
  'ask-question': ['问号开口', '把卡住的地方问清楚', '让一个问号在心里过夜'],
  'sleep-early': ['提前打烊', '给被窝提前开门', '睡前临时召开人生大会'],
  'morning-stretch': ['松松筋骨', '等水开时转转肩膀', '一睁眼就给筋骨上难度'],
  'strength-training': ['留把力气', '把熟悉的动作做稳', '和上一组的自己逞强'],
  'easy-run': ['慢跑一站', '慢慢跑到下一个路口', '跟红绿灯比配速'],
  'balanced-meal': ['头口归己', '专心吃第一口热饭', '把饭点交给下一部短视频'],
  'drink-water': ['杯中有余', '把水杯放到伸手可及处', '忙到把水杯当摆设'],
  'rest-eyes': ['借一点远景', '抬头看看窗外最远处', '从大屏休息到小屏'],
  'health-check': ['旧单归档', '翻翻上次的体检记录', '拿搜索结果给自己下结论'],
  'contact-friend': ['忽然想起', '给想起来的人发个消息', '把一句问候攒成一封长信'],
  'say-thanks': ['迟到回执', '把谢谢说具体一点', '让一句谢谢在草稿里过期'],
  'listen-carefully': ['半拍之后', '让对方把那一段讲完', '抢在故事讲完前猜结局'],
  'team-conversation': ['说清下回', '散会前说清谁接下一棒', '靠一句「那就这样」交接'],
  'meet-someone': ['从这儿聊', '从眼前的小事聊起', '把自我介绍讲成年度述职'],
  'family-time': ['旧事开桌', '听一段家里的旧故事', '低头刷屏错过饭桌下半场'],
  'make-peace': ['撤回重说', '把那句抱歉说具体', '在道歉后面加个「但」'],
  'share-good-news': ['小喜报', '把一桩小喜事发给懂的人', '把值得开心的事憋到月底'],
  'clean-room': ['桌面停靠', '给杯子腾出一个位置', '把桌上的东西统统推给抽屉'],
  'organize-wardrobe': ['旧衣上场', '把想穿的旧衣挂到前面', '为了搭一件衣服再买三件'],
  'cook-meal': ['热饭现做', '用冰箱边角做点热乎的', '把洗碗留给明天饿着的自己'],
  'small-repair': ['小物复职', '修好一件舍不得扔的小物', '让一颗纽扣拖到明年'],
  'care-plants': ['盆栽朝阳', '看看窗边的绿植', '拿一壶水表达全部关心'],
  'do-laundry': ['新鲜换班', '换条干净的擦手巾', '让晾干的衣服在椅背安家'],
  'review-budget': ['购物车冷静期', '给下单留一个晚上', '为了凑满减多买两样'],
  declutter: ['闲物下一站', '给闲置找个新去处', '为了收纳杂物再买一堆盒子'],
  'take-walk': ['顺路绕一圈', '拐进一条没走过的小路', '边散步边追消息'],
  'go-hiking': ['山路小歇', '走一段能看见天的路', '临出门就把散步升级成翻山'],
  'ride-bike': ['途中可停', '停车看看平时掠过的风景', '路上跟时速表较劲'],
  'watch-sunset': ['黄昏有席', '去等天色换一层颜色', '忙着拍天空忘了抬头看'],
  'park-break': ['长椅有空', '借张公园长椅坐一会儿', '把发呆也排进绩效表'],
  'city-walk': ['换边经过', '走熟悉街道的另一侧', '照着路线赶完所有打卡点'],
  'take-photos': ['一小片光', '拍一小片落下来的光', '让滤镜比照片更抢戏'],
  'have-picnic': ['点心出门', '带一份小点心去户外', '为野餐收拾出一套厨房'],
  'write-something': ['今天有旁白', '为今天写三行旁白', '盯着第一句反复改到天黑'],
  'draw-picture': ['杯子入画', '画一件手边的寻常物', '把橡皮用得比笔还勤'],
  'practice-instrument': ['半拍慢练', '慢慢弹顺最卡的一小节', '一上来就把节拍器拧满'],
  'make-craft': ['纸角余生', '拿旧纸折一枚书签', '先买齐工具才肯做第一件'],
  'shoot-video': ['小事登场', '拍十秒没什么大事的日常', '把十秒素材剪成通宵'],
  brainstorm: ['离谱有位', '给最离谱的点子留一行', '在点子说完前举手否决'],
  'design-solution': ['另画一笔', '给同一件事画个第二方案', '拿精致的图遮住没想清的事'],
  'collect-ideas': ['偶然碰面', '让两条旧灵感碰个面', '收藏三屏灵感一条也不打开'],
  'watch-anime': ['下一集见', '补一集惦记着的番', '把下一集点成下一季'],
  'watch-movie': ['今晚放映', '挑一部今晚真想看的片', '选片的时间长过片长'],
  'play-game': ['存档还在', '回存档里的世界逛一圈', '玩到最后只剩清任务'],
  'listen-podcast': ['路上有声', '边走边听一段故事', '把所有订阅都标成待补'],
  'build-model': ['零件归位', '给模型装好一个部件', '把桌边当成零件安全区'],
  'see-performance': ['现场有座', '找一场想亲耳听的演出', '全程举着手机看现场'],
  'read-comics': ['停在这一格', '慢一点翻过喜欢的那格', '为了追进度跳过整页画面'],
  'play-with-pet': ['它来选', '陪它玩一轮它选的游戏', '在它睡着时单方面开赛'],
};

function copyFor({ activityId }: FortuneItem) {
  return activityId ? signCopy[activityId] : undefined;
}

/** 同一公历日得到同一张签。签等由 acer 的完整宜忌条目数决定。 */
export function createDailySign(day: Pick<CalendarDay, 'year' | 'month' | 'day'>) {
  const { good, bad } = generateFortuneV2(day);
  const [lead] = good;
  if (!lead) throw new Error('每日签缺少主签');

  const balance = good.length - bad.length;
  return {
    rank: balance > 0 ? '上签' : balance < 0 ? '下签' : '中签',
    title: copyFor(lead)?.[0] ?? lead.activity,
    good: good.slice(0, 2).map((item) => copyFor(item)?.[1] ?? item.activity),
    bad: bad.slice(0, 2).map((item) => copyFor(item)?.[2] ?? item.activity),
  };
}

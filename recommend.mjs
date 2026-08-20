// ============================================================================
// 内容库（演示用）+ 推荐引擎 + 用户偏好(profile)
// ============================================================================
// ⚠️ 版权声明：本内容库所有"哪首歌在哪个平台能听"均为【示例/演示数据】，
//    用于演示"按我的爱好推荐会员"的逻辑。真实版权以各平台当前为准，
//    且不同歌/剧的版权经常变化。真实版应接一个可更新的内容索引
//    （或平台官方授权 API / 自研爬虫），本文件结构就是给那个"真实数据源"
//    预留的接口：保持 `scoreMemberships` 与 `lookupContent()` 的返回形状即可替换。
// ============================================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// ---------- 兴趣 → 该平台的内容覆盖率（0~1） ----------
const COVER = {
  嘻哈: { 'QQ音乐豪华绿钻': 0.7, '网易云音乐黑胶VIP': 0.6 },
  流行: { 'QQ音乐豪华绿钻': 0.8, '酷狗音乐VIP': 0.7, 网易云音乐黑胶VIP: 0.5 },
  '国风/古风': { 网易云音乐黑胶VIP: 0.85, 'QQ音乐豪华绿钻': 0.4 },
  '二次元/日系': { 网易云音乐黑胶VIP: 0.8, 'QQ音乐豪华绿钻': 0.4 },
  古典: { 网易云音乐黑胶VIP: 0.75, 'QQ音乐豪华绿钻': 0.5, 'Apple Music': 1.0 },
  'K-Pop': { 'QQ音乐豪华绿钻': 0.85, 网易云音乐黑胶VIP: 0.3 },
  '爵士/慢歌': { 网易云音乐黑胶VIP: 0.7, 'Apple Music': 1.0 },
  '运动/跑步': { 'QQ音乐豪华绿钻': 0.8, 网易云音乐黑胶VIP: 0.6 },
  热剧: { 腾讯视频VIP: 0.8, 爱奇艺黄金VIP: 0.8, 优酷VIP: 0.7 },
  日漫: { 'B站大会员': 0.9, 芒果TV会员: 0.3, 优酷VIP: 0.4 },
  美剧: { 优酷VIP: 0.75, 腾讯视频VIP: 0.5 },
  电影: { 爱奇艺黄金VIP: 0.8, 腾讯视频VIP: 0.7 },
  纪录片: { 'B站大会员': 0.8, 优酷VIP: 0.6 },
};

// ---------- 可直接搜的 "歌/剧 → 哪个平台能看"（演示小库） ----------
const CONTENT_ITEMS = [
  { title: '晴天（周杰伦）', kind: '流行', where: ['QQ音乐', '网易云音乐'], note: '版权示例，以平台为准' },
  { title: '江南（林俊杰）', kind: '流行', where: ['网易云音乐', 'QQ音乐'] },
  { title: '起风了（买辣椒也用券）', kind: '流行', where: ['QQ音乐', '网易云音乐'] },
  { title: '孤勇者（陈奕迅）', kind: '流行', where: ['QQ音乐', '网易云音乐'] },
  { title: '以父之名（周杰伦）', kind: '嘻哈', where: ['QQ音乐'] },
  { title: '夏目友人帐', kind: '日漫', where: ['B站', '芒果TV'] },
  { title: '进击的巨人', kind: '日漫', where: ['B站', '优酷'] },
  { title: '狂飙', kind: '热剧', where: ['爱奇艺'] },
  { title: '三体', kind: '热剧', where: ['腾讯视频'] },
  { title: '繁花', kind: '热剧', where: ['腾讯视频'] },
  { title: '流浪地球2', kind: '电影', where: ['爱奇艺', '优酷'] },
];

// 候选会员（月费），用于"该开通哪些"
const CATALOG = [
  { name: 'QQ音乐豪华绿钻', category: '音乐', price: 18 },
  { name: '网易云音乐黑胶VIP', category: '音乐', price: 15 },
  { name: '酷狗音乐VIP', category: '音乐', price: 12 },
  { name: 'Apple Music', category: '音乐', price: 10 },
  { name: '腾讯视频VIP', category: '视频', price: 30 },
  { name: '爱奇艺黄金VIP', category: '视频', price: 25 },
  { name: '优酷VIP', category: '视频', price: 25 },
  { name: '芒果TV会员', category: '视频', price: 22 },
  { name: 'B站大会员', category: '视频', price: 25 },
  { name: '百度网盘超级会员', category: '云存储', price: 30 },
  { name: 'iCloud 200GB', category: '云存储', price: 21 },
  { name: '京东PLUS', category: '购物', price: 8 },
  { name: '美团外卖神会员', category: '生活', price: 15 },
];

const PROF_FILE = new URL('./profile.json', import.meta.url);

export function loadProfile() {
  if (!existsSync(PROF_FILE)) return { interests: [], budgetPerMonth: 50, createdAt: null };
  try { return JSON.parse(readFileSync(PROF_FILE, 'utf8')); }
  catch { return { interests: [], budgetPerMonth: 50, createdAt: null }; }
}
export function saveProfile(p) { writeFileSync(PROF_FILE, JSON.stringify(p, null, 2), 'utf8'); }

// 把用户输入（歌/剧/平台/兴趣词）解析成规范兴趣词
export function normalizeInterest(raw) {
  const r = String(raw || '').trim();
  for (const key of Object.keys(COVER)) {
    if (r.includes(key) || key.includes(r)) return key;
  }
  const hit = CONTENT_ITEMS.find((i) => i.title.includes(r) || r.includes(i.title));
  if (hit) return hit.kind;
  return r;
}

// 按兴趣给候选会员打分
export function scoreMemberships(interests) {
  const acc = {};
  for (const key of interests) {
    const map = COVER[key];
    if (!map) continue;
    for (const [svc, cover] of Object.entries(map)) {
      acc[svc] = (acc[svc] || 0) + cover;
    }
  }
  return CATALOG.map((m) => {
    const s = acc[m.name] || 0;
    return { ...m, score: Math.round(s * 100) };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

// 生成推荐文本
export function buildRecommendation(interests, budget) {
  const ranked = scoreMemberships(interests);
  const L = [];
  L.push(`根据你的爱好（${interests.join('、') || '暂未设置'}），推荐的会员：`);
  let total = 0;
  for (const r of ranked) { total += r.price; L.push(`  • **${r.name}**（${r.category}）¥${r.price}/月 — 匹配 ${r.score}%`); }
  if (!ranked.length) L.push('  （还没告诉我够多的兴趣，先聊聊你爱听什么歌/看什么）');
  L.push(`推荐合计约 **¥${total}/月**。预算 ${budget}/月 ${total > budget ? `⚠️超支，建议只留前 ${Math.max(1, Math.floor(ranked.length * budget / total))} 个` : '✅ 在预算内。'}`);
  // "哪些内容在哪"演示
  const hits = CONTENT_ITEMS.filter((i) => interests.some((k) => i.kind === k || i.title.includes(k)));
  if (hits.length) {
    L.push('');
    L.push('「歌/剧在哪能看/听」（演示样例，实际以平台为准）：');
    for (const h of hits) L.push(`• ${h.title} → ${h.where.join('、')}${h.note ? `（${h.note}）` : ''}`);
  }
  return L.join('\n');
}

export function lookupContent() { return CONTENT_ITEMS; }
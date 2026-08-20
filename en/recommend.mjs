// ============================================================================
// Content library (demo) + recommendation engine + user profile
// ============================================================================
// ⚠️ Copyright note: all "which platform streams a song/show" data here is
//    EXAMPLE / DEMO data, used to demonstrate the "recommend memberships by my
//    interests" logic. Real licensing depends on each platform's current terms,
//    and rights for individual songs/shows change often. For a production build
//    you should plug in an updatable content index (or platform official /
//    authorized APIs or your own crawler). This file's structure is the
//    interface reserved for that "real data source": keep the return shapes of
//    `scoreMemberships` and `lookupContent()` and you can swap the underlying data.
// ============================================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// ---------- interest → content coverage of that platform (0~1) ----------
const COVER = {
  hiphop: { 'Netflix Premium': 0.4, 'Amazon Prime': 0.3, 'YouTube Premium': 0.5, 'Spotify Premium': 0.9, 'Apple Music': 0.7, Hulu: 0.4 },
  pop: { 'Netflix Premium': 0.5, 'Amazon Prime': 0.4, 'Spotify Premium': 0.95, 'Apple Music': 0.85, 'YouTube Premium': 0.6, Hulu: 0.3 },
  'K-pop': { 'Spotify Premium': 0.95, 'Apple Music': 0.9, 'YouTube Premium': 0.8, 'Netflix Premium': 0.5, Hulu: 0.2 },
  anime: { 'Netflix Premium': 0.85, 'Crunchyroll': 0.95, 'Hulu': 0.4, 'Amazon Prime': 0.3 },
  'K-drama': { 'Netflix Premium': 0.95, 'Disney+': 0.5, Hulu: 0.35 },
  movies: { 'Netflix Premium': 0.9, 'Disney+': 0.8, 'Amazon Prime': 0.7, Hulu: 0.6, 'Apple TV+': 0.5 },
  classical: { 'Spotify Premium': 0.8, 'Apple Music': 0.85, 'YouTube Premium': 0.5 },
  workout: { 'Spotify Premium': 0.9, 'Apple Music': 0.8, 'YouTube Premium': 0.6, 'Netflix Premium': 0.3 },
  'true-crime': { 'Netflix Premium': 0.9, 'Hulu': 0.75, 'Disney+': 0.3 },
  documentaries: { 'Netflix Premium': 0.9, 'Disney+': 0.7, 'Amazon Prime': 0.6, 'Hulu': 0.4 },
  sitcom: { 'Netflix Premium': 0.8, 'Hulu': 0.75, 'Amazon Prime': 0.5, 'Disney+': 0.4 },
};

// ---------- direct searchable "song/show → which platform" (small demo library) ----------
const CONTENT_ITEMS = [
  { title: 'Blinding Lights (The Weeknd)', kind: 'pop', where: ['Spotify', 'Apple Music', 'YouTube Music'], note: 'copyright sample, subject to platform' },
  { title: 'Shape of You (Ed Sheeran)', kind: 'pop', where: ['Spotify', 'Apple Music'] },
  { title: 'Dynamite (BTS)', kind: 'K-pop', where: ['Spotify', 'Apple Music', 'YouTube Music'] },
  { title: 'God’s Plan (Drake)', kind: 'hiphop', where: ['Spotify', 'Apple Music'] },
  { title: 'Levels (Avicii)', kind: 'pop', where: ['Spotify', 'Apple Music'] },
  { title: 'Demon Slayer: Kimetsu no Yaiba', kind: 'anime', where: ['Netflix', 'Crunchyroll'] },
  { title: 'Attack on Titan', kind: 'anime', where: ['Netflix', 'Hulu', 'Crunchyroll'] },
  { title: 'Crash Landing on You', kind: 'K-drama', where: ['Netflix'] },
  { title: 'Money Heist', kind: 'drama', where: ['Netflix'] },
  { title: 'Stringer Bell (The Wire)', kind: 'drama', where: ['Amazon Prime'] },
  { title: 'Interstellar', kind: 'movies', where: ['Netflix', 'Amazon Prime'] },
  { title: 'Sherlock (BBC)', kind: 'true-crime', where: ['Netflix', 'Hulu', 'Amazon Prime'] },
  { title: "The Good Place", kind: 'sitcom', where: ['Netflix', 'Hulu'] },
];

// candidate memberships (monthly price), used for "which ones to keep"
const CATALOG = [
  { name: 'Netflix Premium', category: 'video', price: 15 },
  { name: 'Disney+', category: 'video', price: 14 },
  { name: 'YouTube Premium', category: 'video', price: 14 },
  { name: 'Amazon Prime', category: 'video', price: 9 },
  { name: 'Hulu', category: 'video', price: 10 },
  { name: 'Apple TV+', category: 'video', price: 7 },
  { name: 'Crunchyroll', category: 'video', price: 8 },
  { name: 'Netflix Basic', category: 'video', price: 9 },
  { name: 'Paramount+', category: 'video', price: 8 },
  { name: 'Spotify Premium', category: 'music', price: 11 },
  { name: 'Apple Music', category: 'music', price: 11 },
  { name: 'YouTube Music', category: 'music', price: 10 },
  { name: 'iCloud+', category: 'storage', price: 3 },
  { name: 'Google One', category: 'storage', price: 2 },
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
  const r = String(raw || '').trim().toLowerCase();
  for (const key of Object.keys(COVER)) {
    if (r.includes(key) || key.includes(r)) return key;
  }
  const hit = CONTENT_ITEMS.find((i) => i.title.toLowerCase().includes(r) || r.includes(i.title.toLowerCase()));
  if (hit) return hit.kind;
  return raw || r;
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
  L.push(`Based on your interests (${interests.join(', ') || 'not set yet'}), here are the subscriptions I recommend:`);
  let total = 0;
  for (const r of ranked) { total += r.price; L.push(`  • **${r.name}** (${r.category}) $${r.price}/month — matches ${r.score}%`); }
  if (!ranked.length) L.push('  (You haven’t told me enough about your interests yet — tell me what songs you like or what shows you watch)');
  L.push(`Recommended total ≈ **$${total}/month**. Budget $${budget}/month ${total > budget ? `⚠️ over budget — consider keeping only the top ${Math.max(1, Math.floor(ranked.length * budget / total))} subscriptions` : '✅ within budget.'}`);
  // "what content is where" demo
  const hi = CONTENT_ITEMS.filter((i) => interests.some((k) => i.kind === k || i.title.toLowerCase().includes(k)));
  if (hi.length) {
    L.push('');
    L.push('“What can be streamed where” (demo examples, subject to each platform):');
    for (const h of hi) L.push(`• ${h.title} → ${h.where.join(', ')}${h.note ? ` (${h.note})` : ''}`);
  }
  return L.join('\n');
}

export function lookupContent() { return CONTENT_ITEMS; }
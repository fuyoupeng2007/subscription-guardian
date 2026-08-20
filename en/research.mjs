// ============================================================================
// 真实调研（联网）—— 用公开搜索接口查"某歌/某剧在哪个平台有"
// ============================================================================
// 说明：
//   - 走的是网易云音乐、QQ音乐、B站 的公开 HTTP 搜索接口（无需 key，国内可直连）。
//   - 返回"该平台能不能搜到这条内容"，即真实的存在性证据（真数据）。
//   - 接口属公开端点，正式商用/上线建议替换为各平台官方开放授权 API；
//     本模块把"该去哪查"与"怎么展示结果"封装好，换数据源不改调用方式。
// 用法（CLI）： node index.mjs --research 晴天    或   --where 周杰伦
// 法（模块）： import { research } from './research.mjs'; await research('晴天');
// ============================================================================

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// —— 网易云音乐：公开搜索接口 ——
export async function searchNetease(q, limit = 5) {
  const url =
    'http://music.163.com/api/search/get/web?s=' + encodeURIComponent(q) + '&type=1&limit=' + limit;
  const res = await fetch(url, {
    headers: { Referer: 'http://music.163.com', 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json();
  return (j.result?.songs || []).map((s) => ({
    title: s.name,
    artist: (s.artists || []).map((a) => a.name).join('/') || 'Unknown',
    album: s.album?.name || '',
  }));
}

// —— QQ音乐：公开搜索接口 ——
export async function searchQQ(q, limit = 5) {
  const url =
    'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=' + encodeURIComponent(q) + '&format=json&p=1&n=' + limit;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  const m = text.match(/\{[\s\S]*\}/);
  const j = m ? JSON.parse(m[0]) : {};
  return (j.data?.song?.list || []).map((s) => ({
    title: s.songname,
    artist: (s.singer || []).map((x) => x.name).join('/') || 'Unknown',
    album: s.album?.name || '',
  }));
}

// —— B站：公开搜索接口（番剧/视频） ——
export async function searchBilibili(k, limit = 5) {
  const url =
    'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=' +
    encodeURIComponent(k) +
    '&page=1';
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json();
  const list = j?.data?.result || [];
  return list.slice(0, limit).map((v) => ({ title: v?.title?.replace(/<[^>]*>/g, '') || '', author: v?.author || '' }));
}

// —— 主入口：对每个平台并行真实查询，返回"哪个平台有" ——
export async function research(q) {
  const out = { query: q, platforms: [] };
  const [netease, qq, bili] = await Promise.all([
    searchNetease(q).catch((e) => ({ error: e.message })),
    searchQQ(q).catch((e) => ({ error: e.message })),
    searchBilibili(q).catch((e) => ({ error: e.message })),
  ]);
  out.platforms.push(makeEntry('NetEase Cloud Music', netease));
  out.platforms.push(makeEntry('QQ Music', qq));
  out.platforms.push(makeEntry('Bilibili', bili));
  return out;
}

function makeEntry(name, res) {
  if (!res || res.error) return { platform: name, reachable: false, error: res?.error || 'No response', found: 0, top: [] };
  return { platform: name, reachable: true, found: res.length, top: res.slice(0, 3) };
}

// 展示成英文文本（给 REPL / --research / 工具回调用）
export function renderResearch(r) {
  const L = [];
  L.push(`🔎 Real research for "${r.query}":`);
  for (const p of r.platforms) {
    if (!p.reachable) { L.push(`  • ${p.platform}: ⚠️ Query failed (${p.error})`); continue; }
    const line = p.found > 0
      ? `  • ${p.platform}: ✅ Found (${p.found} results); e.g. "${(p.top[0]?.title || '')} - ${p.top[0]?.artist || p.top[0]?.author || ''}"`
      : `  • ${p.platform}: ❌ Not found`;
    L.push(line);
  }
  return L.join('\n');
}
// 分析引擎 —— 所有"算账"都在这，100% 确定性，保证数字准确
import { getSubscriptions } from './datasources/index.mjs';

// 加载订阅数据（走数据接入层：有真实数据用它，否则用示例）
export async function loadSubscriptions() {
  return getSubscriptions().list;
}
// 当前用的数据源信息（sample=示例 / user=你的真实数据）
export function currentDataSource() {
  return getSubscriptions();
}

// 计算完整的财务分析（总花费 / 重叠 / 涨价 / 续费 / 可省金额）
export function getFinancialFacts(subs, now = new Date()) {
  const totalMonthly = subs.reduce((s, x) => s + x.monthlyPrice, 0);
  const totalYearly = totalMonthly * 12;

  // 按类别分组，找重叠订阅
  const byCategory = {};
  for (const s of subs) (byCategory[s.category] ??= []).push(s);
  const overlaps = Object.entries(byCategory)
    .filter(([, list]) => list.length > 1)
    .map(([category, list]) => {
      // 同一类别保留"月费最高"的那个作为主力，取消其余
      const sorted = [...list].sort((a, b) => b.monthlyPrice - a.monthlyPrice);
      const keep = sorted[0];
      const cancel = sorted.slice(1);
      return {
        category,
        all: list.map((s) => s.name),
        keep: keep.name,
        cancel: cancel.map((s) => s.name),
        cancelMonthly: cancel.reduce((a, s) => a + s.monthlyPrice, 0),
        currentCost: list.reduce((a, s) => a + s.monthlyPrice, 0),
      };
    });

  // 涨价检测（现价 > 原价）
  const priceIncreases = subs
    .filter((s) => s.monthlyPrice > s.originalPrice)
    .map((s) => ({ name: s.name, from: s.originalPrice, to: s.monthlyPrice, note: s.note || '' }));

  // 即将续费 / 到期（按日期排）
  const renewals = subs
    .filter((s) => s.autoRenew)
    .sort((a, b) => a.renewOn.localeCompare(b.renewOn))
    .map((s) => ({ name: s.name, date: s.renewOn, price: s.monthlyPrice }));

  const totalSavableMonthly = overlaps.reduce((a, o) => a + o.cancelMonthly, 0);
  const totalSavableYearly = totalSavableMonthly * 12;

  // 分类支出汇总（用于仪表盘可视化）
  const categorySummary = Object.entries(byCategory)
    .map(([category, list]) => ({
      category,
      count: list.length,
      total: list.reduce((a, s) => a + s.monthlyPrice, 0),
    }))
    .sort((a, b) => b.total - a.total);

  // 重叠里的最大省项（喊话最大的机会）
  const biggestWin = overlaps.length
    ? overlaps.reduce((a, b) => (b.cancelMonthly > a.cancelMonthly ? b : a))
    : null;

  return {
    currency: 'CNY',
    asOf: new Date().toISOString().slice(0, 10),
    totalCount: subs.length,
    totalMonthly,
    totalYearly,
    overlaps,
    priceIncreases,
    renewals,
    categorySummary,
    biggestWin,
    totalSavableMonthly,
    totalSavableYearly,
  };
}

// 模拟取消指定订阅后的变化（支持模糊匹配，如"腾讯视频"能匹配"腾讯视频VIP"）
export function simulateCancellation(subs, cancelNames) {
  cancelNames = (cancelNames || []).map((n) => String(n).trim()).filter(Boolean);
  // 模糊匹配：名称互相包含即命中，避免用户/LLM 说简称时匹配不上
  const removed = subs.filter((sub) =>
    cancelNames.some((n) => sub.name.includes(n) || n.includes(sub.name))
  );
  const removedNames = removed.map((s) => s.name);
  const remaining = subs.filter((s) => !removedNames.includes(s.name));
  const beforeMonthly = subs.reduce((s, x) => s + x.monthlyPrice, 0);
  const afterMonthly = remaining.reduce((s, x) => s + x.monthlyPrice, 0);
  const matched = cancelNames.filter((n) => removedNames.some((r) => r.includes(n) || n.includes(r)));
  return {
    requested: cancelNames,
    matched,
    removed: removedNames,
    notFound: cancelNames.filter((n) => !matched.includes(n)),
    beforeMonthly,
    afterMonthly,
    monthlySaved: beforeMonthly - afterMonthly,
    yearlySaved: (beforeMonthly - afterMonthly) * 12,
    remainingCount: remaining.length,
  };
}

// 把分析结果渲染成 Markdown 报告
export function renderMarkdown(facts) {
  return [
    `# 🧠 订阅管家分析报告`,
    ``,
    `> 生成：${facts.asOf} ｜ 币种：${facts.currency}（元）`,
    ``,
    `## 📊 订阅总览`,
    `- 共有 **${facts.totalCount}** 个付费订阅`,
    `- 每月合计 **${facts.totalMonthly} 元**，每年约 **${facts.totalYearly} 元**`,
    ``,
    `## ⚠️ 重叠订阅（浪费钱）`,
    ...(facts.overlaps.length
      ? facts.overlaps.map((o) =>
          `- **【${o.category}】** 同时开了 ${o.all.join('、')}（每月 ${o.currentCost} 元）。建议保留 **${o.keep}**，取消 ${o.cancel.join('、')}，每月省 **${o.cancelMonthly} 元**。`
        )
      : ['- 检查发现重叠订阅 ✅']),
    ``,
    `## 📈 涨价提醒`,
    ...(facts.priceIncreases.length
      ? facts.priceIncreases.map((p) => `- **${p.name}**：从 ${p.from} 元涨到 ${p.to} 元${p.note ? `（${p.note}）` : ''}`)
      : ['- 未被发现涨价项']),
    ``,
    `## ⏰ 即将续费 / 自动续费`,
    ...(facts.renewals.length
      ? facts.renewals.map((r) => `- **${r.name}**：${r.date} 自动续费 ${r.price} 元`)
      : ['- 无']),
    ``,
    `## 💡 建议总结`,
    `- 建议取消的重叠订阅，每月最多可省 **${facts.totalSavableMonthly} 元**（一年约 **${facts.totalSavableYearly} 元**）。`,
    `- 建议优先取消：` +
      (facts.overlaps.length ? facts.overlaps.map((o) => `${o.cancel.join('、')}（${o.category}）`).join('；') : '暂无'),
    '',
  ].join('\n');
}

// 把分析结果渲染成自包含的 HTML 仪表盘
export function renderHtml(facts) {
  const overlapCards = facts.overlaps
    .map(
      (o) => `
      <div class="card">
        <div class="card-title">${o.category} · 重叠 ${o.all.length} 个</div>
        <div class="card-sub">当前：${o.all.join(' / ')}（${o.currentCost} 元/月）</div>
        <div class="card-row"><span>建议保留</span><b class="ok">${o.keep}</b></div>
        <div class="card-row"><span>建议取消</span><b class="warn">${o.cancel.join('、')}</b></div>
        <div class="card-row"><span>每月可省</span><b class="money">${o.cancelMonthly} 元</b></div>
      </div>`
    )
    .join('');

  const hikes = facts.priceIncreases.length
    ? facts.priceIncreases.map((p) => `<li>📈 ${p.name}：${p.from} → <b>${p.to} 元</b></li>`).join('')
    : '<li class="muted">未发现涨价项 ✅</li>';

  const renewals = facts.renewals
    .map((r) => `<li>⏰ <b>${r.name}</b>（${r.price} 元）· ${r.date}</li>`)
    .join('');

  // 分类支出的横向条形图（纯 CSS，最大类别占满宽）
  const maxCat = Math.max(...facts.categorySummary.map((c) => c.total), 1);
  const bars = facts.categorySummary
    .map(
      (c) => `
      <div class="bar-row">
        <div class="bar-label">${c.category} <span>${c.count}项</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c.total / maxCat) * 100)}%"></div></div>
        <div class="bar-val">¥${c.total}</div>
      </div>`
    )
    .join('');

  // 最大省项 hero
  const hero = facts.biggestWin
    ? `<div class="hero">
        <div class="hero-tag">💰 最大优化点</div>
        <div class="hero-line">取消「${facts.biggestWin.category}」里的 ${facts.biggestWin.cancel.join('、')}，<span class="money">每月立省 ${facts.biggestWin.cancelMonthly} 元</span></div>
       </div>`
    : '';

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>订阅管家 · 报告</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
         background: radial-gradient(1200px 600px at 80% -10%, #1e3a5f, transparent),
                     radial-gradient(800px 500px at -10% 110%, #7c3aed22, transparent),
                     linear-gradient(165deg, #0b1220, #111827 70%);
         color: #e2e8f0; min-height: 100vh; padding: 40px 20px; }
  .wrap { max-width: 880px; margin: 0 auto; }
  .hero { background: linear-gradient(135deg,#fbbf2415,#f59e0b22); border:1px solid #fbbf2433; border-radius:16px; padding:18px 20px; margin:22px 0 6px; font-size:16px; }
  .hero-tag { font-size:12px; letter-spacing:.12em; color:#fbbf24; margin-bottom:6px; font-weight:700; }
  .hero-line { line-height:1.6; }
  h1 { font-size: 28px; margin-bottom: 6px; }
  .punch { color:#94a3b8; font-size:14px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 26px; letter-spacing:.03em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 14px; margin-bottom: 26px; }
  .stat { background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 18px; }
  .stat .v { font-size: 30px; font-weight: 800; letter-spacing:-.02em; }
  .stat .l { color:#94a3b8; font-size:12px; margin-top:5px; }
  .stat.hot { background: linear-gradient(160deg, rgba(251,191,36,.14), rgba(251,191,36,.03)); border-color:#fbbf2455; }
  .stat.hot .v { color: #fbbf24; }
  h2 { font-size: 17px; margin: 28px 0 14px; letter-spacing:.02em; }
  h2 .dim { color:#64748b; font-size:12px; font-weight:400; margin-left:8px; }
  .card { background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }
  .card-title { font-weight: 700; font-size: 15px; }
  .card-sub { color:#94a3b8; font-size:13px; margin:6px 0 10px; }
  .card-row { display:flex; justify-content:space-between; padding:3px 0; font-size:14px; }
  .ok{color:#34d399; font-weight:600} .warn{color:#f87171; font-weight:600} .money{color:#fbbf24; font-weight:700}
  ul { list-style:none; }
  li { background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:10px 14px; margin-bottom:8px; font-size:14px; }
  li.muted { color:#94a3b8; }
  .bar-row { display:grid; grid-template-columns: 92px 1fr 56px; gap:12px; align-items:center; margin-bottom:10px; }
  .bar-label { font-size:13px; color:#cbd5e1; } .bar-label span { color:#64748b; font-size:11px; display:block; }
  .bar-track { height:10px; background: rgba(255,255,255,.07); border-radius:999px; overflow:hidden; }
  .bar-fill { height:100%; background: linear-gradient(90deg,#3b82f6,#8b5cf6); border-radius:999px; }
  .bar-val { font-size:13px; font-weight:700; color:#e2e8f0; text-align:right; }
  .foot { margin-top: 40px; color:#475569; font-size:12px; text-align:center; }
</style>
</head>
<body><div class="wrap">
  <h1>🧠 订阅管家 · 分析报告</h1>
  <div class="punch">你的 ${facts.totalCount} 个订阅，替你揪出每个月被悄悄扣掉的钱。</div>
  <div class="meta">生成 ${facts.asOf} ｜ 币种 ${facts.currency.toUpperCase()} ｜ 由 Strands 多智能体 + 本地 Qwen 生成</div>
  <div class="grid">
    <div class="stat"><div class="v">${facts.totalCount}</div><div class="l">付费订阅</div></div>
    <div class="stat"><div class="v">¥${facts.totalMonthly}</div><div class="l">每月花费</div></div>
    <div class="stat"><div class="v">¥${facts.totalYearly}</div><div class="l">每年花费</div></div>
    <div class="stat hot"><div class="v">¥${facts.totalSavableMonthly}</div><div class="l">每月可省</div></div>
    <div class="stat hot"><div class="v">¥${facts.totalSavableYearly}</div><div class="l">每年可省</div></div>
  </div>
  ${hero}
  <h2>💳 分类支出</h2>
  ${bars}
  <h2>⚠️ 重叠订阅 <span class="dim">建议去重</span></h2>${overlapCards || '<div class="card-sub">无</div>'}
  <h2>📈 涨价提醒</h2><ul>${hikes}</ul>
  <h2>⏰ 即将续费</h2><ul>${renewals}</ul>
  <div class="foot">由 Strands Agents SDK + 本地 Qwen 生成｜订阅管家 Subscription Guardian</div>
</div></body></html>`;
}

// 生成简短、准确的「复核事实摘要」（给人给模型读，而不是 dump 原始 JSON）
export function renderGroundTruth(facts) {
  const lines = [];
  lines.push(`订阅总数：${facts.totalCount} 个；每月总花费 ${facts.totalMonthly} 元；每年 ${facts.totalYearly} 元。`);
  for (const o of facts.overlaps) {
    lines.push(
      `重叠【${o.category}】：同开 ${o.all.join('、')}（每月 ${o.currentCost} 元）。保留「${o.keep}」，取消「${o.cancel.join('、')}」，每月省 ${o.cancelMonthly} 元。`
    );
  }
  lines.push(
    facts.priceIncreases.length
      ? `涨价：${facts.priceIncreases.map((p) => `${p.name} 从${p.from}元涨到${p.to}元`).join('；')}。`
      : '涨价：无。'
  );
  lines.push(
    `取消这些重叠订阅后，每月最多可省 ${facts.totalSavableMonthly} 元，一年 ${facts.totalSavableYearly} 元。`
  );
  return lines.join('\n');
}
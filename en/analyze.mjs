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
    currency: 'USD',
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
    `# 🧠 Subscription Guardian Analysis Report`,
    ``,
    `> Generated: ${facts.asOf} ｜ Currency: ${facts.currency} ($)`,
    ``,
    `## 📊 Overview`,
    `- You have **${facts.totalCount}** paid subscription(s)`,
    `- **$${facts.totalMonthly}/month** total, about **$${facts.totalYearly}/year**`,
    ``,
    `## ⚠️ Overlapping subscriptions (waste)`,
    ...(facts.overlaps.length
      ? facts.overlaps.map((o) =>
          `- **[${o.category}]** You're paying for ${o.all.join(', ')} ($${o.currentCost}/month). Keep **${o.keep}**, cancel ${o.cancel.join(', ')} and save **$${o.cancelMonthly}/month**.`
        )
      : ['- No overlapping subscriptions found ✅']),
    ``,
    `## 📈 Price increases`,
    ...(facts.priceIncreases.length
      ? facts.priceIncreases.map((p) => `- **${p.name}**: went from $${p.from} to $${p.to}${p.note ? ` (${p.note})` : ''}`)
      : ['- No price increases found']),
    ``,
    `## ⏰ Upcoming renewals`,
    ...(facts.renewals.length
      ? facts.renewals.map((r) => `- **${r.name}**: auto-renews on ${r.date} for $${r.price}`)
      : ['- None']),
    ``,
    `## 💡 Recommendations`,
    `- By canceling overlapping subs, you can save up to **$${facts.totalSavableMonthly}/month** (about **$${facts.totalSavableYearly}/year**).`,
    `- Prioritize canceling: ` +
      (facts.overlaps.length ? facts.overlaps.map((o) => `${o.cancel.join(', ')} (${o.category})`).join('; ') : 'none for now'),
    '',
  ].join('\n');
}

// 把分析结果渲染成自包含的 HTML 仪表盘
export function renderHtml(facts) {
  const overlapCards = facts.overlaps
    .map(
      (o) => `
      <div class="card">
        <div class="card-title">${o.category} · ${o.all.length} overlapping</div>
        <div class="card-sub">Current: ${o.all.join(' / ')} ($${o.currentCost}/month)</div>
        <div class="card-row"><span>Keep</span><b class="ok">${o.keep}</b></div>
        <div class="card-row"><span>Cancel</span><b class="warn">${o.cancel.join(', ')}</b></div>
        <div class="card-row"><span>Save per month</span><b class="money">$${o.cancelMonthly}</b></div>
      </div>`
    )
    .join('');

  const hikes = facts.priceIncreases.length
    ? facts.priceIncreases.map((p) => `<li>📈 ${p.name}: $${p.from} → <b>$${p.to}</b></li>`).join('')
    : '<li class="muted">No price increases found ✅</li>';

  const renewals = facts.renewals
    .map((r) => `<li>⏰ <b>${r.name}</b> ($${r.price}) · ${r.date}</li>`)
    .join('');

  // 分类支出的横向条形图（仅 CSS，最大类别占满宽度）
  const maxCat = Math.max(...facts.categorySummary.map((c) => c.total), 1);
  const bars = facts.categorySummary
    .map(
      (c) => `
      <div class="bar-row">
        <div class="bar-label">${c.category} <span>${c.count} item(s)</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c.total / maxCat) * 100)}%"></div></div>
        <div class="bar-val">$${c.total}</div>
      </div>`
    )
    .join('');

  // 最大省项 hero
  const hero = facts.biggestWin
    ? `<div class="hero">
        <div class="hero-tag">💰 Biggest opportunity</div>
        <div class="hero-line">Cancel ${facts.biggestWin.cancel.join(' & ')} in "${facts.biggestWin.category}", <span class="money">save $${facts.biggestWin.cancelMonthly}/month</span></div>
       </div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Subscription Guardian · Report</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Segoe UI", system-ui, sans-serif;
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
  <h1>🧠 Subscription Guardian · Analysis Report</h1>
  <div class="punch">Your ${facts.totalCount} subscription(s), with the money silently charged to you each month called out.</div>
  <div class="meta">Generated ${facts.asOf} ｜ Currency ${facts.currency.toUpperCase()} ｜ Generated by Strands agents + local Qwen</div>
  <div class="grid">
    <div class="stat"><div class="v">${facts.totalCount}</div><div class="l">Paid subscriptions</div></div>
    <div class="stat"><div class="v">$${facts.totalMonthly}</div><div class="l">Price per month</div></div>
    <div class="stat"><div class="v">$${facts.totalYearly}</div><div class="l">Per year</div></div>
    <div class="stat hot"><div class="v">$${facts.totalSavableMonthly}</div><div class="l">Save per month</div></div>
    <div class="stat hot"><div class="v">$${facts.totalSavableYearly}</div><div class="l">Save per year</div></div>
  </div>
  ${hero}
  <h2>💳 Spend by category</h2>
  ${bars}
  <h2>⚠️ Overlapping subs <span class="dim">dedupe recommended</span></h2>${overlapCards || '<div class="card-sub">None</div>'}
  <h2>📈 Price increases</h2><ul>${hikes}</ul>
  <h2>⏰ Upcoming renewals</h2><ul>${renewals}</ul>
  <div class="foot">Generated by Strands Agents SDK + local Qwen ｜ Subscription Guardian</div>
</div></body></html>`;
}

// 生成简短、准确的「复核事实摘要」（给人/模型读，而不是丢原始 JSON）
export function renderGroundTruth(facts) {
  const lines = [];
  lines.push(`Total subscriptions: ${facts.totalCount}; total monthly spend $${facts.totalMonthly}; per year $${facts.totalYearly}.`);
  for (const o of facts.overlaps) {
    lines.push(
      `Overlap [${o.category}]: holding ${o.all.join(', ')} ($${o.currentCost}/month). Keep "${o.keep}", cancel "${o.cancel.join(', ')}", saving $${o.cancelMonthly}/month.`
    );
  }
  lines.push(
    facts.priceIncreases.length
      ? `Price increases: ${facts.priceIncreases.map((p) => `${p.name} went from $${p.from} to $${p.to}`).join('; ')}.`
      : 'Price increases: none.'
  );
  lines.push(
    `After canceling these overlapping subscriptions, you can save up to $${facts.totalSavableMonthly}/month and $${facts.totalSavableYearly}/year.`
  );
  return lines.join('\n');
}
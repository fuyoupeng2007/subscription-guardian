// 订阅管家 —— Agents for Humans Hackathon · CLI 入口
// 架构：核心引擎在 core.mjs（Strands 工具 + 本地 Qwen），本文件只负责交互入口。
// 运行：
//   node index.mjs          # 交互对话（REPL）
//   node index.mjs --report # 一键报告
//   node index.mjs --multi  # 多智能体
//   node index.mjs --recommend# 按爱好推荐
//   node index.mjs --watch  # 后台提醒
//   node index.mjs --research "晴天"（真联网查歌/剧在哪个平台）
import { createInterface } from 'node:readline/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Agent } from '@strands-agents/sdk';
import { renderMarkdown, renderHtml, renderGroundTruth } from './analyze.mjs';
import { loadProfile, saveProfile, normalizeInterest, buildRecommendation } from './recommend.mjs';
import { research, renderResearch } from './research.mjs';
import { model, systemPrompt, facts, dataSource, tools, agent } from './core.mjs';

// ---------- 生成报告（markdown + html 落盘） ----------
function writeReport() {
  mkdirSync('reports', { recursive: true });
  const md = renderMarkdown(facts);
  const html = renderHtml(facts);
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const mdPath = `reports/report-${stamp}.md`;
  const htmlPath = `reports/report-${stamp}.html`;
  writeFileSync(mdPath, md, 'utf8');
  writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ Report generated:');
  console.log(`   Markdown: ${mdPath}`);
  console.log(`   HTML dashboard: ${htmlPath}`);
  console.log('\n' + md);
}

// ---------- 后台监控模式 ----------
function watchMode(days = 7) {
  const limit = new Date(Date.now() + days * 24 * 3600 * 1000);
  const upcoming = facts.renewals.filter((r) => new Date(r.date) <= limit);
  if (upcoming.length === 0) {
    console.log(`🤖 Subscription Guardian [${new Date().toISOString()}] No renewals in the next ${days} days — all good.`);
    return;
  }
  console.log(`⚠️ Subscription Guardian [${new Date().toISOString()}] ${upcoming.length} renewal(s) in the next ${days} days need your attention:`);
  for (const r of upcoming) {
    console.log(`   - ${r.name}: auto-renews on ${r.date} for $${r.price}`);
  }
  console.log(`\nEstimated total charge: $${upcoming.reduce((a, r) => a + r.price, 0)}.`);
}

// ---------- 交互对话（REPL） ----------
async function repl() {
  console.log('🧠 Subscription Guardian is ready. Try asking:');
  console.log('  · "analyze my subscriptions / any overlaps / how much do I spend a month"');
  console.log('  · "simulate what I save if I cancel Netflix and Hulu"');
  console.log('  · "find where I can stream Blinding Lights"');
  console.log('  · type "exit" to quit\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    let input;
    try {
      input = (await rl.question('you> ')).trim();
    } catch {
      break;
    }
    if (!input) continue;
    if (/^(exit|quit|退出|拜拜)$/i.test(input)) {
      console.log('👋 Goodbye!');
      break;
    }
    const start = Date.now();
    const result = await agent.invoke(input);
    console.log(`\n💬 Subscription Guardian (${((Date.now() - start) / 1000).toFixed(1)}s):`, result.toString());
    console.log('\n');
  }
  rl.close();
}

// ---------- 多智能体报告（分析员 → 复核员） ----------
async function multiReport() {
  console.log('🧠 Starting multi-agent pipeline: analyst → reviewer\n');

  const analystSys = `You are the "Subscription Guardian" analyst. Your task is:
1) Call the get_financial_facts tool to get 100% accurate financial data (total spend / overlaps / price increases / renewals / savings)
2) Draft a complete, well-structured English subscription analysis report (Markdown) based on it
Rules: use the tool output as the only numeric source — do not do arithmetic or invent figures. Report structure:
## 📊 Overview
## ⚠️ Overlapping subscriptions
## 📈 Price increases
## ⏰ Upcoming renewals
## 💡 Recommendations`;
  const analyst = new Agent({ model, systemPrompt: analystSys, tools, printer: false });
  const analystResult = await analyst.invoke('Please analyze my subscriptions using the tools and produce a complete English subscription analysis report.');
  const draft = analystResult.toString();
  console.log('　· Analyst finished the draft, handing it to the reviewer for fact-checking…\n');

  const reviewerSys = `You are the "Subscription Guardian" reviewer. Your job is to fact-check the analyst draft line by line, judging everything against [accurate facts]:
- If a draft number disagrees with [accurate facts] → correct it using the accurate fact
- Remove anything not mentioned in [accurate facts] (invented price increases, invented overlaps, etc.)
- Then output a clean final English Markdown (## headings + - lists), ending the report with a line "✅ Reviewed";
- Do not add numbers or items not present in the accurate facts`;
  const reviewer = new Agent({ model, systemPrompt: reviewerSys, printer: false });
  const reviewPrompt = [
    '[Accurate facts (the only numeric basis to rely on)]',
    renderGroundTruth(facts),
    '',
    '[Analyst draft]',
    draft,
    '',
    'Please review: 1) Fix draft numbers that disagree with the accurate facts; 2) remove anything not in the accurate facts; 3) output the final English Markdown report.',
  ].join('\n');
  const finalResult = await reviewer.invoke(reviewPrompt);
  const finalText = finalResult.toString();

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  mkdirSync('reports', { recursive: true });
  const mdPath = `reports/report-multi-${stamp}.md`;
  const htmlPath = `reports/report-multi-${stamp}.html`;
  writeFileSync(mdPath, finalText, 'utf8');
  writeFileSync(htmlPath, renderHtml(facts), 'utf8');
  console.log(`✅ Multi-agent report generated: ${mdPath}\n`);
  console.log(finalText);
}

// ---------- 推荐模式 ----------
async function recommendMode() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const profile = loadProfile();
  console.log('🎯 Recommend mode: I help you decide which memberships to start / keep / cancel based on your interests.');
  console.log(`(Current interests: ${profile.interests.join(', ') || 'not set yet'} ｜ budget $${profile.budgetPerMonth}/month)`);
  console.log('Say "skip" if you don’t want to bother. You can list several separated by spaces or commas.');
  console.log('');
  try {
    if (!profile.interests.length) {
      const ans = await rl.question('What are you into? E.g. hiphop, pop, K-pop, anime, K-drama, movies, classical, workout, true-crime, documentaries, sitcom…\n> ');
      const interests = ans
        .split(/[,，\s、;；]+/)
        .filter(Boolean)
        .map((x) => normalizeInterest(x))
        .filter((x) => x);
      profile.interests = interests;
    }
    const budgetAns = await rl.question(`How much are you willing to spend on memberships per month (default ${profile.budgetPerMonth})? > `);
    const b = parseInt(budgetAns, 10);
    if (!Number.isNaN(b) && b > 0) profile.budgetPerMonth = b;
    const more = await rl.question('Any more interests to add? (Enter to skip / e.g. anime)\n> ');
    const extra = more
      .split(/[,，;]+/)
      .map((x) => normalizeInterest(x))
      .filter((x) => x && x !== 'skip');
    profile.interests = [...new Set([...profile.interests, ...extra])];
    saveProfile(profile);
    console.log('\n' + buildRecommendation(profile.interests, profile.budgetPerMonth));
  } catch {
    console.log('\n(Input finished)');
  } finally {
    rl.close();
  }
}

// ---------- 入口分发 ----------
const arg = process.argv[2];
if (arg === '--report' || arg === '-r') {
  writeReport();
} else if (arg === '--watch') {
  watchMode(parseInt(process.argv[3] || '7', 10));
} else if (arg === '--multi' || arg === '-m') {
  await multiReport();
} else if (arg === '--recommend' || arg === '-c') {
  await recommendMode();
} else if (arg === '--research' || arg === '--where' || arg === '-w') {
  const q = (process.argv[3] || '').trim();
  if (!q) {
    console.log('Usage: node index.mjs --research "<song or show name>"');
    console.log('Example: node index.mjs --research "Blinding Lights"');
  } else {
    console.log(renderResearch(await research(q)));
  }
} else {
  await repl();
}
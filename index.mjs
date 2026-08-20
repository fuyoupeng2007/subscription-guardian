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
  console.log('✅ 已生成报告：');
  console.log(`   Markdown: ${mdPath}`);
  console.log(`   HTML 仪表盘: ${htmlPath}`);
  console.log('\n' + md);
}

// ---------- 后台监控模式 ----------
function watchMode(days = 7) {
  const limit = new Date(Date.now() + days * 24 * 3600 * 1000);
  const upcoming = facts.renewals.filter((r) => new Date(r.date) <= limit);
  if (upcoming.length === 0) {
    console.log(`🤖 订阅管家 [${new Date().toISOString()}] 未来 ${days} 天内无即将续费的订阅，一切正常。`);
    return;
  }
  console.log(`⚠️ 订阅管家 [${new Date().toISOString()}] 未来 ${days} 天内有 ${upcoming.length} 项需要你决定：`);
  for (const r of upcoming) {
    console.log(`   - ${r.name}：${r.date} 将自动续费 ${r.price} 元`);
  }
  console.log(`\n预计扣款合计：${upcoming.reduce((a, r) => a + r.price, 0)} 元。`);
}

// ---------- 交互对话（REPL） ----------
async function repl() {
  console.log('🧠 订阅管家已就绪。你可以问：');
  console.log('  · "分析一下我的订阅 / 有什么重叠 / 每月花多少"');
  console.log('  · "模拟我把腾讯视频和芒果TV取消了能省多少"');
  console.log('  · "查一下晴天在哪个平台能听"');
  console.log('  · 输入 "exit" 或 "退出" 结束\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    let input;
    try {
      input = (await rl.question('你> ')).trim();
    } catch {
      break;
    }
    if (!input) continue;
    if (/^(exit|quit|退出|拜拜)$/i.test(input)) {
      console.log('👋 再见！');
      break;
    }
    const start = Date.now();
    const result = await agent.invoke(input);
    console.log(`\n💬 订阅管家（${((Date.now() - start) / 1000).toFixed(1)}s）:`, result.toString(), '\n');
  }
  rl.close();
}

// ---------- 多智能体报告（分析员 → 复核员） ----------
async function multiReport() {
  console.log('🧠 启动多智能体流水线：分析员 → 复核员\n');

  const analystSys = `你是订阅管家「分析员」。你的任务是：
1) 调用 get_financial_facts 工具获取 100% 准确的财务数据（总花费/重叠/涨价/续费/可省金额）
2) 据此起草一份完整、结构清晰的中文订阅分析报告（Markdown）
规则：以工具返回为唯一数字来源，不要心算、不要编造。报告结构：
## 📊 订阅总览
## ⚠️ 重叠订阅
## 📈 涨价提醒
## ⏰ 即将续费
## 💡 建议总结`;
  const analyst = new Agent({ model, systemPrompt: analystSys, tools, printer: false });
  const analystResult = await analyst.invoke('请用工具分析我的订阅，生成一份完整的中文订阅分析报告。');
  const draft = analystResult.toString();
  console.log('　· 分析员已完成草稿，交给复核员核验…\n');

  const reviewerSys = `你是订阅管家「复核员」。你的任务是逐条核对分析员草稿，一切以【准确事实】为准：
- 草稿数字与【准确事实】不一致 → 用准确事实改正
- 删除草稿里【准确事实】没有提到的内容（虚构的涨价、虚构的重叠等）
- 然后输出一份干净的最终中文 Markdown 报告（## 标题 + - 列表），末尾加一行「✅ 已复核」；
- 不要新增准确事实里没有的数字或条目`;
  const reviewer = new Agent({ model, systemPrompt: reviewerSys, printer: false });
  const reviewPrompt = [
    '【准确事实（只准以它为数字依据）】',
    renderGroundTruth(facts),
    '',
    '【分析员草稿】',
    draft,
    '',
    '请复核：1) 草稿数字与准确事实不一致就改；2) 删除草稿里准确事实没有的内容；3) 输出最终中文 Markdown 报告。',
  ].join('\n');
  const finalResult = await reviewer.invoke(reviewPrompt);
  const finalText = finalResult.toString();

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  mkdirSync('reports', { recursive: true });
  const mdPath = `reports/report-multi-${stamp}.md`;
  const htmlPath = `reports/report-multi-${stamp}.html`;
  writeFileSync(mdPath, finalText, 'utf8');
  writeFileSync(htmlPath, renderHtml(facts), 'utf8');
  console.log(`✅ 多智能体报告已生成：${mdPath}\n`);
  console.log(finalText);
}

// ---------- 推荐模式 ----------
async function recommendMode() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const profile = loadProfile();
  console.log('🧭 推荐模式：我按「你的爱好」帮你判断该开 / 该留 / 该取消哪些会员。');
  console.log(`（当前偏好：${profile.interests.join('、') || '还没说'}｜预算 ${profile.budgetPerMonth}/月）`);
  console.log('不想麻烦就说"跳过"。可以一次说多个，用空格或逗号分隔。');
  console.log('');
  try {
    if (!profile.interests.length) {
      const ans = await rl.question('你喜欢哪些？例如：嘻哈、流行、二次元、热剧、日漫、电影…\n> ');
      const interests = ans
        .split(/[,，\s、;；]+/)
        .filter(Boolean)
        .map((x) => normalizeInterest(x))
        .filter((x) => x);
      profile.interests = interests;
    }
    const budgetAns = await rl.question(`你每月愿为会员花多少（默认 ${profile.budgetPerMonth} 元）？> `);
    const b = parseInt(budgetAns, 10);
    if (!Number.isNaN(b) && b > 0) profile.budgetPerMonth = b;
    const more = await rl.question('还想补充其他爱好吗？（回车跳过 / 二次元 之类）\n> ');
    const extra = more
      .split(/[,，、;]+/)
      .map((x) => normalizeInterest(x))
      .filter((x) => x && x !== '跳过');
    profile.interests = [...new Set([...profile.interests, ...extra])];
    saveProfile(profile);
    console.log('\n' + buildRecommendation(profile.interests, profile.budgetPerMonth));
  } catch {
    console.log('\n（已结束输入）');
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
    console.log('用法：node index.mjs --research "<歌或剧名>"');
    console.log('例：node index.mjs --research 七里香');
  } else {
    console.log(renderResearch(await research(q)));
  }
} else {
  await repl();
}
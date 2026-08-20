// ============================================================================
// server.mjs —— 网页版「订阅管家」后端（启动后自动打开浏览器，告别黑终端）
//   启动： node server.mjs         然后浏览器访问 http://localhost:3000
// ============================================================================
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { renderMarkdown, renderHtml } from './analyze.mjs';
import { buildRecommendation } from './recommend.mjs';
import { research, renderResearch } from './research.mjs';
import { agent, facts, dataSource } from './core.mjs';

const PORT = process.env.PORT || 3100;
const UI = readFileSync(fileURLToPath(new URL('./public/index.html', import.meta.url)), 'utf8');

function send(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// 读请求体 + parse JSON
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // 首页 UI
  if (req.method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(UI);
    return;
  }

  // ============ JSON API ============
  if (req.method === 'POST' && url === '/api/status') {
    return send(res, 200, {
      dataSource,
      totalCount: facts.totalCount,
      totalMonthly: facts.totalMonthly,
      totalYearly: facts.totalYearly,
      totalSavableMonthly: facts.totalSavableMonthly,
      totalSavableYearly: facts.totalSavableYearly,
      biggestWin: facts.biggestWin || null,
      categorySummary: facts.categorySummary || [],
      renewals: facts.renewals,
      overlaps: facts.overlaps,
      priceIncreases: facts.priceIncreases,
    });
  }

  if (req.method === 'POST' && url === '/api/report') {
    return send(res, 200, { markdown: renderMarkdown(facts), html: renderHtml(facts) });
  }

  if (req.method === 'POST' && url === '/api/research') {
    const { query } = await readBody(req);
    const r = await research(String(query || '').trim());
    return send(res, 200, { text: renderResearch(r) });
  }

  if (req.method === 'POST' && url === '/api/recommend') {
    const { interests, budget } = await readBody(req);
    const list = Array.isArray(interests) ? interests.filter(Boolean) : [];
    return send(res, 200, { text: buildRecommendation(list, Number(budget) || 50) });
  }

  if (req.method === 'POST' && url === '/api/chat') {
    const { message } = await readBody(req);
    const t0 = Date.now();
    const result = await agent.invoke(String(message || ''));
    return send(res, 200, { text: result.toString(), seconds: ((Date.now() - t0) / 1000).toFixed(1) });
  }

  send(res, 404, { error: 'Not found', hint: '/ for UI, POST /api/* for data' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🧠 Subscription Guardian web UI started:`);
  console.log(`   → open  http://localhost:${PORT}`);
  // Windows 自动打开浏览器
  exec(`start http://localhost:${PORT}`, () => {});
});
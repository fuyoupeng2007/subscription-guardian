// ============================================================================
// core.mjs —— 共享引擎：模型 + Strands 工具 + Agent + 数据
// CLI(index.mjs) 和 网页后端(server.mjs) 都用同一套配置，避免重复
// ============================================================================
import { mkdirSync, writeFileSync } from 'node:fs';
import { Agent, FunctionTool } from '@strands-agents/sdk';
import { OpenAIModel } from '@strands-agents/sdk/models/openai';
import { getSubscriptions } from './datasources/index.mjs';
import { getFinancialFacts, simulateCancellation } from './analyze.mjs';
import { research, renderResearch } from './research.mjs';

// ---------- 数据（走接入层：真实数据优先，否则示例） ----------
const ds = getSubscriptions();
export const subs = ds.list;
export const dataSource = { source: ds.source, isSample: ds.isSample, file: ds.file };
export const facts = getFinancialFacts(subs);

// ---------- 模型：本地 Qwen（Ollama 的 OpenAI 兼容接口，免费离线） ----------
export const model = new OpenAIModel({
  api: 'chat',
  modelId: 'qwen2.5:3b',
  apiKey: 'ollama',
  temperature: 0.3,
  maxTokens: 1400,
  clientConfig: { baseURL: 'http://127.0.0.1:11434/v1' },
});

// ---------- Strands 工具（算账层，100% 确定、数字准确；research 为真联网） ----------
export const tools = [
  new FunctionTool({
    name: 'get_subscriptions',
    description: 'Read the user subscription list (JSON) and return all subscriptions with name/category/monthly price/renewal date.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    callback: () => {
      console.error('[🔧 tool invoked get_subscriptions]');
      return { currency: 'USD', subscriptions: subs };
    },
  }),
  new FunctionTool({
    name: 'get_financial_facts',
    description:
      'Return the financial analysis of the subscriptions: total spend, overlapping subscriptions, price increases, upcoming renewals, monthly/yearly savings. All numbers are pre-computed; do not do the math yourself.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    callback: () => {
      console.error('[🔧 tool invoked get_financial_facts]');
      return facts;
    },
  }),
  new FunctionTool({
    name: 'simulate_cancel',
    description: 'Simulate what changes after "canceling the given subscriptions". Pass an array of subscription names to cancel; returns the monthly/yearly spend and savings after cancellation, plus any unmatched names.',
    inputSchema: {
      type: 'object',
      properties: { names: { type: 'array', items: { type: 'string' }, description: 'Array of subscription names to cancel' } },
      required: ['names'],
    },
    callback: (input) => {
      console.error(`[🔧 tool invoked simulate_cancel] names=${JSON.stringify(input?.names)}`);
      return simulateCancellation(subs, input?.names || []);
    },
  }),
  new FunctionTool({
    name: 'save_report',
    description: 'Save a Markdown report into the reports/ directory and return the saved path.',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: 'The Markdown content to save' } },
      required: ['markdown'],
    },
    callback: (input) => {
      console.error('[🔧 tool invoked save_report]');
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      mkdirSync('reports', { recursive: true });
      const path = `reports/report-${stamp}.md`;
      writeFileSync(path, input?.markdown ?? '', 'utf8');
      return { path };
    },
  }),
  new FunctionTool({
    name: 'research_content',
    description:
      'Real online research: find which platform can stream a song or show. Pass a content name (e.g. a song, artist or anime title); returns whether NetEase Cloud Music, QQ Music and Bilibili each match it, with the best result.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Song or show name to research' } },
      required: ['query'],
    },
    callback: async (input) => {
      console.error(`[🔧 tool invoked research_content] query=${input?.query}`);
      const r = await research(String(input?.query || '').trim());
      return { query: r.query, result: renderResearch(r) };
    },
  }),
];

// ---------- 系统提示词 ----------
export const systemPrompt = `You are the "Subscription Guardian", a friendly AI assistant that helps users manage their paid subscriptions and save money.

You have these tools — for any question involving numbers you MUST call them (do not do the math yourself):
- get_subscriptions: fetch the subscription list
- get_financial_facts: fetch the pre-computed financial analysis (overlaps, price increases, renewals, savings)
- simulate_cancel: pass the names to cancel and simulate the resulting spend and savings
- save_report: save a report to a file
- research_content: do real online research on which platform can stream a given song/show

Behavior guidelines:
- Always respond in English
- Whenever amounts/overlaps/savings about my subscriptions are involved, call get_financial_facts first
- When the user asks to "simulate canceling", call simulate_cancel and report the exact savings
- When the user wants to know where a song/show can be streamed, call research_content
- To archive/export a report, call save_report and provide the file path
- Be friendly, concrete, and specific, like a thoughtful finance manager`;

// ---------- 组装 Agent ----------
export const agent = new Agent({ model, systemPrompt, tools, printer: false });
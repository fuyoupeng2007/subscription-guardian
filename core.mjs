// ============================================================================
// core.mjs —— 共享引擎：模型 + Strands 工具 + Agent + 数据
// CLI(index.mjs) 和 网页后端(server.mjs) 都用同一套配置，避免重复
// ============================================================================
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
    description: '读取用户的订阅清单（JSON），返回全部订阅及名称/分类/月费/续费日期。',
    inputSchema: { type: 'object', properties: {}, required: [] },
    callback: () => {
      console.error('[🔧 调用工具 get_subscriptions]');
      return { currency: 'CNY', subscriptions: subs };
    },
  }),
  new FunctionTool({
    name: 'get_financial_facts',
    description:
      '返回订阅的财务分析：总花费、重叠订阅、涨价项、即将续费、每月/每年可省金额。所有数字已经算好，不要自己心算。',
    inputSchema: { type: 'object', properties: {}, required: [] },
    callback: () => {
      console.error('[🔧 调用工具 get_financial_facts]');
      return facts;
    },
  }),
  new FunctionTool({
    name: 'simulate_cancel',
    description: '模拟"取消指定订阅"后的变化。输入一组要取消的订阅名称，返回取消后每月/每年花费与节省，以及无效的名称。',
    inputSchema: {
      type: 'object',
      properties: { names: { type: 'array', items: { type: 'string' }, description: '要取消的订阅名称数组' } },
      required: ['names'],
    },
    callback: (input) => {
      console.error(`[🔧 调用工具 simulate_cancel] names=${JSON.stringify(input?.names)}`);
      return simulateCancellation(subs, input?.names || []);
    },
  }),
  new FunctionTool({
    name: 'save_report',
    description: '把一份 Markdown 报告保存到 reports/ 目录，返回保存的路径。',
    inputSchema: {
      type: 'object',
      properties: { markdown: { type: 'string', description: '要保存的 Markdown 内容' } },
      required: ['markdown'],
    },
    callback: (input) => {
      console.error('[🔧 调用工具 save_report]');
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
      '真实联网调研：查「某首歌或某部剧」在哪个平台能听/能看。输入内容名（如 晴天 / 周杰伦 / 夏目友人帐），返回网易云音乐、QQ音乐、B站各自是否搜得到及最匹配的结果。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '要调研的歌曲或剧集名称' } },
      required: ['query'],
    },
    callback: async (input) => {
      console.error(`[🔧 调用工具 research_content] query=${input?.query}`);
      const r = await research(String(input?.query || '').trim());
      return { query: r.query, result: renderResearch(r) };
    },
  }),
];

// ---------- 系统提示词 ----------
export const systemPrompt = `你是「订阅管家」，一位帮用户管理付费订阅、省钱的 AI 助手。

你有这些工具，涉及数字的问题必须调用它们（不要自己心算）：
- get_subscriptions：取订阅清单
- get_financial_facts：取已经算好的财务分析（重叠、涨价、续费、可省金额）
- simulate_cancel：输入要取消的名称，模拟取消后的花费与节省
- save_report：把报告存成文件
- research_content：真联网查「某歌/剧在哪个平台能听」

行为准则：
- 全部用简体中文回答
- 涉及我的订阅的金额/重叠/省多少，先调用 get_financial_facts
- 用户让"模拟取消"，调用 simulate_cancel，报准确节省金额
- 用户想查某歌某剧在哪个会员能听，调用 research_content
- 要留档/导出报告时，调用 save_report 并提供文件路径
- 回答友好、具体，像贴心的理财管家`;

// ---------- 组装 Agent ----------
export const agent = new Agent({ model, systemPrompt, tools, printer: false });
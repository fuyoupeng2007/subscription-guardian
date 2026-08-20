# 🧠 订阅管家（Subscription Guardian）

[![Strands](https://img.shields.io/badge/Strands%20Agents%20SDK-v1.13-blue)](#)
[![Local](https://img.shields.io/badge/Model-Ollama%20Qwen2.5-orange)](#)
[![Offline&Free](https://img.shields.io/badge/Offline%20%26%20Free-no%20API%20key-green)](#)
[![Bilingual](https://img.shields.io/badge/Languages-ZH%20%2B%20EN-8b5cf6)](#)

一个用 **Strands Agents SDK** 构建的 AI 智能体：帮你管理付费订阅/会员，找出重叠订阅、涨价、即将续费的项目，并给出「该取消什么、每月能省多少钱」的建议。它还**真联网**查「某首歌/剧在哪个会员能听」。

> 参赛项目：**[Agents for Humans Hackathon](https://agentsforhumans.devpost.com/)**（Amazon / AWS 主办）
> 支持 **中文版 + 英文版**两套完全独立、并行部署运行。

## 🚀 快速开始
```bash
npm install          # 首次：装 Strands SDK + openai
node server.mjs      # 打开漂亮网页界面 http://localhost:3000
# 或：node index.mjs（终端交互）；node index.mjs --research "七里香"（真联网调研）
```

## 🌐 中英文双版（各自独立、并行运行）

本仓库含**两套完全独立**的版本，结构相同、内容语言不同：

| | 中文版 ZH | 英文版 EN |
|---|---|---|
| 目录 | 根目录本级 | `en\` |
| 网页 UI 端口 | http://localhost:3000 | http://localhost:3100 |
| 界面 / 终端 / 数据 | 中文 + 国内示例会员 | 英文 + 美元示例服务 |

- **一键同时启动两套**：双击 `start-both.bat`，会各开一个窗口、各弹出浏览器。
- 或分别：中文 `node server.mjs`；英文 `cd en & node server.mjs`。
- 两套互不干扰，可同时在线、各自维护。

## 🎯 它解决什么问题

很多人同时开着好几个视频会员、音乐会员、云存储会员，自己都记不清。这个 agent 像一个**在后台默默记账的理财管家**——只在需要你决策时才冒出来提醒你。

## 🖥️ 网页版界面（推荐使用，告别黑终端）

```bash
node server.mjs      # 或：npm start
# 自动打开浏览器 http://localhost:3000
```

漂亮的单页面板，六块功能全可视化：**总览 / 分析报告 / 真实调研 / 按爱好推荐 / AI 对话 / 续费提醒**。
> 💡 最省事：双击 `start.bat` → 直接回车（默认就是网页版）。

## 🧠 多种运行模式（CLI）

```bash
node index.mjs            # 【交互式对话】REPL，能打字问"模拟取消XX省多少"
node index.mjs --report   # 【一键报告】生成 report.md + report.html 仪表盘
node index.mjs --multi    # 【多智能体】分析员起草 → 复核员纠错定稿
node index.mjs --recommend# 【按爱好推荐】假设还没开通，按你的兴趣+预算推荐该开哪些
node index.mjs --research "晴天" # 【真实联网调研】查这首歌/剧在网易云/QQ音乐/B站能不能搜到
node index.mjs --watch 30 # 【后台提醒】未来30天续费，只在有需要决策时才输出
```

> 💡 **懒人启动**：直接双击 `start.bat`，它会自动启动 Ollama、检查依赖和模型，然后弹出菜单让你选模式（含"5 按爱好推荐"）。

## 🧩 关于「真实数据」与「接口」

- 当前 `data/subscriptions.json` 是**演示样例数据**（我编的），不是你的真实信息，程序**不会**读你任何账号。
- 想接**你的真实订阅**：把 `datasources/user-subscriptions.template.json` 拷一份命名成 `user-subscriptions.json` 填入即可，程序自动优先用它。详见 `datasources/README.md`。
- **按爱好推荐**：`--recommend` 会问你音乐/视频偏好与预算，结合"内容库"（演示样例）推荐该开通哪些会员。内容库结构已按可替换真实版权数据源设计。

在交互模式里可以这样问：
- 「分析一下我的订阅 / 有什么重叠 / 每月花多少」
- 「模拟我把腾讯视频、芒果TV取消了能省多少」
- 「把报告保存下来」
- 「退出」结束

## 🛠 技术栈

- **Strands Agents SDK**（TypeScript / JS）— 原生了 Tool 调用
- **Ollama + Qwen2.5-3B**（本地大模型，免费、离线、无需 API key）
- Node.js（纯 JS，无构建步骤）

## 🔧 它用了哪些 Strands 工具

| 工具 | 作用 |
|---|---|
| `get_subscriptions` | 读取订阅清单 |
| `get_financial_facts` | 取已算好的财务分析（重叠/涨价/续费/可省金额）|
| `simulate_cancel` | 模拟取消指定订阅后的花费与节省（支持模糊匹配）|
| `save_report` | 把报告存成文件 |
| `research_content` | **真实联网**查"某歌/某剧在哪个平台能听"（网易云/QQ音乐/B站公开搜索）|

> ⚠️ `research_content` 走的是平台公开搜索接口（可真联网、无需 key）。结果反映"该平台能否搜到该内容"的存在性证据；具体版权能否播放以平台当前为准。

> 设计要点：所有「算账」（重叠、涨价、节省金额）都由**代码确定性计算**，LLM 只负责对话与组织语言——所以数字永远准确，不会编造。

## 🤝 多智能体（`--multi`）

「分析员 → 复核员」两段式流水线：

1. **分析员**（带工具）调用 `get_financial_facts` 取准确数据，起草初稿；
2. **复核员**拿一份简短的【准确事实】逐条核验分析员草稿，纠正数字、删除编造内容，输出定稿。

这样既展示了 Strands 的多智能体编排，又能靠「复核」兜住小模型的错。

## ▶️ 运行

### 💡 最省事：双击 `start.bat`
自动完成「启动 Ollama → 检查依赖 → 检查模型 → 弹菜单选模式」。
（Ollama 请确保在项目上一级目录 `..\ollama\ollama.exe`。

### 📟 手动：

```bash
# 1. 启动本地模型服务（Ollama）
ollama serve

# 2. 拉取中文模型（首次）
ollama pull qwen2.5:3b

# 3. 安装依赖
npm install        # 会装 @strands-agents/sdk 与 openai

# 4. 运行（任选一种模式）
node index.mjs
node index.mjs --report
node index.mjs --watch 30
```

## 📁 文件结构

```
subscription-agent/
├── index.mjs               # agent 主程序（入口，含三种模式）
├── analyze.mjs            # 确定性分析引擎 + 报告渲染
├── data/
│   └── subscriptions.json # 订阅清单（可替换成你自己的）
├── reports/               # 生成的报告（.md 与 .html）【运行时自动创建】
├── package.json
└── README.md
```

## 🔍 怎么改成你自己的

编辑 `data/subscriptions.json`，把你的真实订阅（名称、分类 `category`、月费 `monthlyPrice`、原价 `originalPrice`、续费日期 `renewOn`）填进去，重跑即可。

条目字段：`name`、`category`（视频/音乐/云存储/购物/生活…）、`monthlyPrice`、`originalPrice`、`renewOn`（YYYY-MM-DD）、`autoRenew`、`note`。
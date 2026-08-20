# 🌐 Subscription Guardian (English Version)

The fully **independent English edition** of the Subscription Guardian agent — running in its own folder, own port, own UI, own data, own terminal, in parallel with the Chinese edition.

> Built for **Agents for Humans Hackathon** (Amazon / AWS). Bilingual deployment: ZH (parent folder) on :3000, EN (this folder) on :3100.

## What it does

An AI "money butler" that manages your paid subscriptions:
- Tells you your total spend, overlapping subscriptions (money being wasted), price hikes and upcoming renewals.
- Recommends **which subscriptions to keep / cancel** to save money per month & year.
- **Really searches the web** (live public APIs, no key) to answer: *"which service has this song/show?"* — NetEase Cloud Music, QQ Music, Bilibili.
- **Recommends memberships by your hobbies + budget**, even if you signed up for nothing yet.
- Runs fully **local, free, offline** on Ollama (Qwen) — no cloud, no API key, your data stays on your machine.

## Getting started

```bash
npm install                 # first time: installs Strands SDK + openai
node server.mjs             # web UI  ->  http://localhost:3100
node index.mjs              # terminal (REPL)  you>
node index.mjs --report     # generate report
node index.mjs --research "Blinding Lights"   # real web research
```

Double-click `start.bat` here for a menu (default opens the Web UI).
Use `start-both.bat` in the parent folder to launch **ZH + EN together**.

## Tech
- **Strands Agents SDK** — real tool calling (`get_subscriptions` / `get_financial_facts` / `simulate_cancel` / `save_report` / `research_content`).
- **Ollama + Qwen2.5** local model — offline, free, no API key.
- Node.js, no build step. Sample data is USD/English (edit `data/subscriptions.json` to use yours).

## Structure
```
en/
├── server.mjs · public/index.html   # web UI (English, :3100)
├── index.mjs                        # terminal
├── core.mjs / analyze.mjs / recommend.mjs / research.mjs
├── data/subscriptions.json          # USD demo data (replace with yours)
├── datasources/                     # plug in your real data here
└── start.bat · README.md
```
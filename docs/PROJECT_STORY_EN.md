# 🧠 Subscription Guardian — A Beginner's Journey

> **Project**: Subscription Guardian (订阅管家)
> **Hackathon**: Agents for Humans (Strands Agents SDK)

---

## ✨ Inspiration

Honestly, I didn't start out as someone who "does AI." I didn't even know what an **LLM API key** was. When I entered this hackathon, I was just an ordinary user drowning in overlapping paid subscriptions — iQiyi, Tencent Video, QQ Music, iCloud, Baidu Cloud... every one silently charging me. I had no idea how many I had, or whether any were duplicates.

What I wanted wasn't a report. I wanted someone to **do the accounting for me in the background** and tell me: how much am I really paying every month?

$$ \text{total monthly cost} = \sum_{i=1}^{m} p_i $$

Then tell me where the money is being wasted, which memberships I should keep based on **my own taste**, and — crucially — *"which subscription actually has that song I like?"*. That desire became **Subscription Guardian**.

---

## 🎓 What I Learned

### 1. Never let your AI do arithmetic
My dumbest mistake: I let a small local model "calculate" the totals — and it *invented* a fake price hike and a *nonexistent* overlap. From then on I held one iron rule:

> **Numbers should never be guessed by the model; they should be computed by code.**

So I split the system into two clean layers:

$$ \underbrace{\text{Deterministic compute layer}\;(analyze)}_{\text{100\% accurate}} \;\longrightarrow\; \underbrace{\text{Language layer}\;(LLM)}_{\text{human-readable narration}} $$

```text
get_financial_facts tool  →  hand the LLM numbers that are ALREADY worked out
The model only decides HOW to say it — it never re-computes.
```

### 2. Tools are where Strands gets its power
Strands taught me that **an agent is only as strong as the real data it can fetch through tools**. I wired 5 tools:

| Tool | Purpose |
|---|---|
| `get_subscriptions` | Fetch the subscription list |
| `get_financial_facts` | Fetch the precomputed, accurate analysis |
| `simulate_cancel` | Simulate how much cancelling saves |
| `save_report` | Export a report |
| `research_content` | **Really search the web** for "which platform has this song/show" |

### 3. Local means something
Running on **Ollama + Qwen2.5** locally means it is free, offline, and **your data never leaves your machine**. The cost: a small model that thinks slower and answers simply. That trade-off is worth it, because the AI genuinely belongs to you.

### 4. Deterministic code beats a "clever-looking" model
Everything can be expressed as an exact formula.

**Overlap savings** — keep the most expensive service in a category, cancel the rest:

$$ \text{overlap saving}_c = \Bigg(\sum_{j \in S_c} p_j\Bigg) - \max_{j \in S_c} p_j $$

**Total savings across all categories:**

$$ S_{\text{total}} = \sum_c\Bigg(\Bigg(\sum_{j \in S_c} p_j\Bigg) - \max_{j \in S_c} p_j\Bigg) $$

**Cancellation simulation (fuzzy match)** — a service counts as "hit" when names contain each other:

$$ \text{hits}(q) = \big\{ j : q_i \subseteq \text{name}_j \;\text{or}\; \text{name}_j \subseteq q_i \big\} $$

Because every number is computed by code, every answer is verifiable and reproducible.

---

## 🛠️ How I Built It

### Step 1 — A tiny working Chinese REPL first
Using the **Strands Agents SDK** + a local Ollama Qwen, I built a CLI that answers "how much do I spend?" in the terminal. *Ship the thing that runs first.*

### Step 2 — Give the ledger to deterministic code
A pure function `analyze` reads `subscriptions.json` and computes totals, overlaps, hikes, renewals and savings. The agent only reads these **true** numbers through tools.

### Step 3 — A friendly web UI
The black terminal is unfriendly to beginners, so I added a dependency-free `server.mjs` (native Node `http`) plus a clean single-page UI: **Overview / Report / Research / Recommend / Chat / Renewals**.

### Step 4 — Real web research
For "which membership has this song", crawling every platform's rights database was slow and anti-bot heavy. So I called each platform's **public search API** and used "can it be found?" as evidence:

```text
searchNetease(q) + searchQQ(q) + searchBilibili(q)  →  {per platform: found? / best match}
```

### Step 5 — Two independent bilingual deployments
I split the same engine into **Chinese (:3000)** and **English (:3100)** versions — two fully independent installs with their own UI, terminal, data and prompts, running in parallel.

### Step 6 — Multi-agent review
Finally I added an **analyst → reviewer** pipeline: the analyst drafts, and a reviewer checks the draft against a compact *ground truth*, fixing any number the small model invented:

$$ \text{final} = \text{Reviewer}\big(\text{Draft},\; \text{GroundTruth}\big) $$

---

## 🧗 Challenges I Hit

1. **Hallucination.** The local 3B model, left to summarize numbers, fabricated a price increase. Solution: **compute first, narrate second**; the reviewer only trusts the ground-truth summary.

2. **One crash froze the whole app.** A failed chat call crashed the Node process, so the "Renewals" tab froze too. Solution: wrap **every API in try/catch** — a chat failure now returns a friendly hint and never kills the server.

3. **Copyright data isn't crawlable.** Crawling each music platform is blocked by login / anti-bot / JS. Solution: use **public search endpoints** as "is it in the index" evidence, and honestly label it *"availability varies by platform"*.

4. **Windows batch encoding trap.** Writing Chinese into `start.bat` breaks cmd's GBK parser. Solution: keep launcher scripts ASCII-only; the app UI is Chinese.

5. **As a beginner, I asked too many questions upfront.** I learned to **build a working MVP first, then ask**.

---

## 🔚 Closing thought

If this project taught me one thing, it's this:

> **Don't ask the AI to invent numbers — ask it to make decisions.** Hand it 100%-accurate figures to narrate, hand it your real taste and budget to recommend, and hand it public APIs to search the world.

**Let the math be exact, and let the agent be smart.**
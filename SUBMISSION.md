# 🏁 黑客松提交清单（Agents for Humans）

> 截止参考：2026-09-14（以官网为准：https://agentsforhumans.devpost.com/）

## ✅ 已完成
- [x] 可运行的软件（CLI `index.mjs` + 网页 UI `server.mjs`）
- [x] 公开 GitHub 仓库：https://github.com/fuyoupeng2007/subscription-guardian
- [x] 中文版 + 英文版两套独立并行
- [x] README 说明 + en/README 英文说明
- [x] 真联网调研（网易云/QQ音乐/B站公开接口）

## ⬜ 待办（提交前务必备齐）

### 1. 演示视频（最重要）
- [ ] 录 **1~3 分钟** 竖屏/横屏均可，能看懂即可
- [ ] 内容建议（挑亮点）：
  - 打开网页 UI，点「生成报告」展示分析仪表盘
  - 用「真实调研」输入一首歌（如 *七里香*），展示它真去三大平台查到
  - 用「按爱好推荐」演示按兴趣+预算推荐会员
  - 一句介绍"本地免费离线，可中英双版并行"
- [ ] 视频上传到 YouTube / 可公开链接，填进提交表

### 2. 提交表填写要点
- **问题**：越来越多付费订阅，用户不清楚重叠/涨价/续费，白花钱
- **方案**：一个 Strands 智能体，工具调用取 100% 准确数字 + 真联网查询 + 按偏好推荐
- **Strands 深度用法（评分重点）**：
  - `get_subscriptions` / `get_financial_facts` / `simulate_cancel` / `save_report`
  - `research_content`：真联网查内容在哪个平台
  - 多智能体（分析员→复核员）流水线
  - 后台 `--watch` 提醒模式
- **创新点**：中英双版独立并行部署；本地免费离线；真联网调研
- **录屏里尽量让评委看到 `[🔧 调用工具 …]` 日志** —— 那是"深度使用 Strands"的最直观证据

### 3. 账号 & 资格
- 参赛者账号、Devpost 账号确认
- ⚠️ **地区资格**：DevPost 排除区域含香港/新加坡等，**中国大陆一般可参与**，但请务必登录 DevPost 页面确认"my country/territory"符合要求
- team（个人或组队）信息

### 4. 其它加分项（可选）
- [ ] README 顶部加一段 Demo 视频链接 / 截图
- [ ] 在 README 补"技术架构图"（可用 archify 画 Strands 工具调用流程图）
- [ ] 主页加一张界面截图

## 🚀 本地一键演示命令
```bash
start-both.bat        # 同时起中文(:3000)+英文(:3100) 两套网页
node server.mjs       # 只起中文网页
node index.mjs --research "七里香"   # 命令行真联网演示
```
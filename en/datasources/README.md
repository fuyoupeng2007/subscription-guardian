# 数据接入层（datasources/）—— 接你真实数据的"接口"

现在的订阅数据是**演示样例**（`data/subscriptions.json`），用来展示分析逻辑。
你想分析自己的真实订阅时，不需要改任何代码，用下面任一种方式即可：

## 方法一（最简单）：填一份 `user-subscriptions.json`

1. 把 `user-subscriptions.template.json` 复制→改名为 `user-subscriptions.json`
2. 按模板填你**真实**开通的会员
3. 重跑程序即可，它会自动用你的数据，不再用示例

> 程序每次启动都先找 `datasources/user-subscriptions.json`，存在就用它；不存在才回退到示例数据。

## 方法二：写一个"连接器"模块（更强大）

想直接连某个真实来源（QQ/微信支付账单、App Store 订阅、银行账单…），
新建一个模块（如 `qq.js`），让它「返回订阅数组 + 基本信息」，再改 `index.mjs` 里的优先级即可。
它只要满足左下 schema，就是合法的数据源。

## 字段契约（subscriptions 每一项）

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✅ | 订阅名称 |
| `category` | ✅ | 类别：视频/音乐/云存储/购物/生活… |
| `monthlyPrice` | ✅ | 月费（人民币数字；年付请折算成月） |
| `originalPrice` | ✅ | 原价（>月费表示最近涨价；相同则正常） |
| `renewOn` | ✅ | 下次自动续费日期 `YYYY-MM-DD` |
| `autoRenew` | ✅ | 是否自动续费 `true/false` |
| `note` | 可选 | 备注 |

## 目前的能力边界（你要诚实告诉自己的）
- 现在还**不会**自动读取你的任何账号/支付信息——需要你提供数据。
- "哪首歌在哪个平台能听"的内容库目前是**演示样例**，真实版权随平台动态变化，正式版要接可更新的内容索引/授权 API/爬虫。接口已留好（`content/` 与 `recommend.mjs` 的返回结构），换掉数据源即可。
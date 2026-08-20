// ============================================================================
// 订阅数据接入层 —— 这就是"以后接你真实数据"的接口
// ============================================================================
// 用法：
//  1) 你以后拿到真实订阅数据（QQ/微信支付/App Store/账单导出等），
//     只要按下面的 schema 写进本目录的  user-subscriptions.json ，程序会自动
//     优先用它，而不再用 demo 样例。
//  2) 也可以新增一个"连接器"模块（如 qq.js / ios.js），实现同样返回
//     { subscriptions: [...] } 即可，替换 getSubscriptions() 里的优先级。
//
// 契约（subscriptions 每一项必填字段）：
//   name        订阅名称（字符串）
//   category    类别（视频/音乐/云存储/购物/生活 …）
//   monthlyPrice 月费（数字，人民币；年付请折算成月）
//   originalPrice 原价（>= monthlyPrice 表示涨价情况；没有可等于 monthlyPrice）
//   renewOn     下次自动续费日期 YYYY-MM-DD
//   autoRenew   是否自动续费（true/false）
//   note        备注（可选）
// ============================================================================
import { existsSync, readFileSync } from 'node:fs';

const SAMPLE_PATH = new URL('../data/subscriptions.json', import.meta.url);
const USER_PATH = new URL('./user-subscriptions.json', import.meta.url);

// 返回 { list, source, isSample, raw }
export function getSubscriptions() {
  // ① 优先：用户自己的真实数据（你以后在这个文件里填）
  if (existsSync(USER_PATH)) {
    const raw = JSON.parse(readFileSync(USER_PATH, 'utf8'));
    return {
      list: raw.subscriptions || [],
      source: 'user',
      isSample: false,
      file: 'datasources/user-subscriptions.json',
      raw,
    };
  }
  // ② 回退：示例数据（仅作 demo 演示）
  const raw = JSON.parse(readFileSync(SAMPLE_PATH, 'utf8'));
  return {
    list: raw.subscriptions || [],
    source: 'sample',
    isSample: true,
    file: 'data/subscriptions.json',
    raw,
  };
}
// 璐璐记账 · 异常消费检测
// 本地统计分析 + AI 生成友好提醒文案
import { callAiApi } from './aiClient';
import { getCache, setCache, removeCache } from './aiCache';

const CACHE_KEY = 'lulu_anomaly_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小时

/**
 * 本地统计分析：检测异常消费
 * @param {Object} params
 * @param {Array} params.transactions - 全部交易（当前账本）
 * @param {Function} params.getMonthSummary - (year, month) => summary
 * @returns {Array<{ type: string, category?: string, detail: string, severity: 'high'|'medium'|'low' }>}
 */
export function detectAnomalies({ transactions, getMonthSummary }) {
  const anomalies = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  // 当月交易
  const currentMonthTxs = (transactions || []).filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month && t.type === 'expense';
  });

  const currentSummary = getMonthSummary(year, month);
  if (!currentSummary || currentSummary.transactionCount === 0) return [];

  // --- 检测 1: 分类环比暴涨 ---
  // 获取过去 3 个月的分类平均支出
  const categoryAverages = {};
  let validMonths = 0;
  for (let i = 1; i <= 3; i++) {
    const m = month - i;
    const y = m < 0 ? year - 1 : year;
    const adjustedMonth = m < 0 ? m + 12 : m;
    const s = getMonthSummary(y, adjustedMonth);
    if (s && s.byCategory && s.expense > 0) {
      validMonths++;
      for (const [cat, amt] of Object.entries(s.byCategory)) {
        if (!categoryAverages[cat]) categoryAverages[cat] = [];
        categoryAverages[cat].push(amt);
      }
    }
  }

  if (validMonths > 0 && currentSummary.byCategory) {
    for (const [cat, currentAmt] of Object.entries(currentSummary.byCategory)) {
      const pastAmounts = categoryAverages[cat];
      if (!pastAmounts || pastAmounts.length === 0) continue;
      const avg = pastAmounts.reduce((a, b) => a + b, 0) / pastAmounts.length;
      if (avg <= 0) continue;

      const ratio = currentAmt / avg;
      const diff = currentAmt - avg;

      // 超过 2 倍且差额超过 200 元
      if (ratio >= 2 && diff >= 200) {
        anomalies.push({
          type: 'category_spike',
          category: cat,
          detail: `本月"${cat}"已花 ${currentAmt.toFixed(0)} 元，是近 ${validMonths} 个月平均 ${avg.toFixed(0)} 元的 ${ratio.toFixed(1)} 倍`,
          severity: ratio >= 3 ? 'high' : 'medium',
          ratio,
          diff,
        });
      }
    }
  }

  // --- 检测 2: 单笔高额消费 ---
  // 日均支出（当月至今）
  const dailyAvg = today > 0 ? currentSummary.expense / today : 0;
  if (dailyAvg > 0) {
    for (const t of currentMonthTxs) {
      // 单笔超过日均 5 倍且金额 > 500
      if (t.amount > dailyAvg * 5 && t.amount >= 500) {
        anomalies.push({
          type: 'large_single',
          category: t.category,
          detail: `单笔高额：${t.category} ${t.amount.toFixed(0)} 元（日均支出 ${dailyAvg.toFixed(0)} 元的 ${(t.amount / dailyAvg).toFixed(1)} 倍）`,
          severity: t.amount >= 2000 ? 'high' : 'medium',
          amount: t.amount,
          note: t.note || '',
          date: t.date,
        });
      }
    }
  }

  // --- 检测 3: 本周支出突增 ---
  const weekStart = new Date(now);
  weekStart.setDate(today - (now.getDay() || 7) + 1); // 本周一
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let thisWeekExpense = 0;
  let lastWeekExpense = 0;
  for (const t of currentMonthTxs) {
    const d = new Date(t.date);
    if (d >= weekStart && d <= now) {
      thisWeekExpense += t.amount;
    } else if (d >= lastWeekStart && d < weekStart) {
      lastWeekExpense += t.amount;
    }
  }

  if (lastWeekExpense > 0 && thisWeekExpense > lastWeekExpense * 1.5 && thisWeekExpense - lastWeekExpense >= 300) {
    anomalies.push({
      type: 'weekly_spike',
      detail: `本周支出 ${thisWeekExpense.toFixed(0)} 元，比上周 ${lastWeekExpense.toFixed(0)} 元多了 ${((thisWeekExpense / lastWeekExpense - 1) * 100).toFixed(0)}%`,
      severity: thisWeekExpense > lastWeekExpense * 2 ? 'high' : 'medium',
      thisWeek: thisWeekExpense,
      lastWeek: lastWeekExpense,
    });
  }

  // 按严重度排序，取前 5 条
  anomalies.sort((a, b) => {
    const s = { high: 3, medium: 2, low: 1 };
    return (s[b.severity] || 0) - (s[a.severity] || 0);
  });

  return anomalies.slice(0, 5);
}

/**
 * 用 AI 把异常检测结果转化为友好的提醒文案
 * @param {Array} anomalies - detectAnomalies 的输出
 * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
 */
export async function generateAnomalyMessage(anomalies) {
  if (!anomalies || anomalies.length === 0) {
    return { ok: true, message: '' };
  }

  const anomaliesText = anomalies.map((a) => '- ' + a.detail).join('\n');
  const systemPrompt = `你是"小璐"，一个亲切的记账助手。用户有一些消费异常需要你友善提醒。
要求：
- 用 1-2 句简短的中文提醒，语气亲切不生硬
- 指出最值得关注的 1-2 个异常
- 可以给一个小建议
- 不要使用 Markdown
- 可以用 1 个 emoji`;
  const userPrompt = '以下是检测到的消费异常：\n' + anomaliesText + '\n\n请生成一条友好的提醒文案。';

  const result = await callAiApi({
    system: systemPrompt,
    userMessage: userPrompt,
    temperature: 0.6,
    maxTokens: 150,
  });

  if (result.ok) return { ok: true, message: result.content };
  return { ok: true, message: buildLocalMessage(anomalies) };
}

/**
 * 无 AI 时的本地兜底文案
 */
function buildLocalMessage(anomalies) {
  const top = anomalies[0];
  if (!top) return '';
  switch (top.type) {
    case 'category_spike':
      return `💡 ${top.category}支出比近几个月平均多了不少（${top.ratio.toFixed(1)} 倍），留意一下哦`;
    case 'large_single':
      return `💡 本月有一笔${top.category} ${top.amount.toFixed(0)} 元的大额消费，是日均的好几倍`;
    case 'weekly_spike':
      return `💡 本周支出比上周多了不少，控制一下节奏~`;
    default:
      return '💡 近期消费有些变化，注意查看明细';
  }
}

/**
 * 获取缓存的异常检测结果
 * @param {number} [currentTxCount] - 当前交易总数。传入后会对比缓存时的交易数，
 *   如果不同则视为缓存失效（说明有新交易产生），返回 null 触发重新检测
 */
export async function getCachedAnomalies(currentTxCount) {
  const data = await getCache(CACHE_KEY);
  if (!data) return null;
  // 自定义过期检查：6 小时 + 交易数指纹
  if (Date.now() - data.timestamp > CACHE_TTL) return null;
  if (currentTxCount != null && data.txCount != null && data.txCount !== currentTxCount) return null;
  return data;
}

export async function setCachedAnomalies(anomalies, message, txCount) {
  await setCache(CACHE_KEY, { anomalies, message, txCount, timestamp: Date.now() });
}

export async function clearAnomalyCache() {
  await removeCache(CACHE_KEY);
}

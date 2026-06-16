// 小璐记账 · AI 消费预测
// 基于历史数据预测下月支出和分类分布
import { callAiApi } from './aiClient';
import { getCache, setCache } from './aiCache';

const PREDICTION_SYSTEM_PROMPT = `你是一名专业的个人理财分析师，名字叫"小璐"。请基于用户的历史消费数据，预测下月的支出情况。

输出要求：
- 仅输出纯文本，不要 Markdown 格式
- 不要任何前缀说明
- 控制在 150 字以内
- 用中文，语气专业但亲切
- 可以使用 emoji

分析重点：
1. 预测下月总支出范围（给出最低和最高预估）
2. 最可能超支的 1-2 个分类
3. 一个具体的省钱建议

注意：
- 如果数据不足（<3个月），提醒用户数据不够，预测仅供参考
- 如果有明显季节性波动，要指出（如"春节前后消费通常较高"）`;

function cacheKey() {
  return 'ai_prediction';
}

export async function getCachedPrediction() {
  return getCache(cacheKey());
}

async function setPredictionCache(data) {
  await setCache(cacheKey(), data);
}

/**
 * 生成消费预测
 * @param {Object} params
 * @param {Array} params.recentMonths - 最近几个月的汇总 [{ month, expense, income, byCategory }]
 * @param {Array} params.currentMonthTxs - 当月交易明细
 * @param {string} params.currency - 货币代码
 * @param {boolean} params.forceRegenerate - 是否强制重新生成
 */
export async function generatePrediction({
  recentMonths = [],
  currentMonthTxs = [],
  currency = 'CNY',
  forceRegenerate = false,
}) {
  if (!forceRegenerate) {
    const cached = await getCachedPrediction();
    if (cached && cached.content) {
      return { ok: true, content: cached.content, cached: true, data: cached.data };
    }
  }

  if (recentMonths.length < 2) {
    return {
      ok: true,
      content: '📊 数据不足，至少需要 2 个月的记录才能进行预测。继续记账吧！',
      cached: false,
      data: null,
    };
  }

  // 计算历史平均和趋势
  const expenses = recentMonths.map(m => m.expense);
  const avgExpense = expenses.reduce((s, v) => s + v, 0) / expenses.length;
  const lastExpense = expenses[expenses.length - 1];
  const trend = expenses.length >= 2
    ? (expenses[expenses.length - 1] - expenses[expenses.length - 2]) / expenses[expenses.length - 2] * 100
    : 0;

  // 分类平均
  const categoryAvg = {};
  for (const m of recentMonths) {
    for (const [cat, amt] of Object.entries(m.byCategory || {})) {
      if (!categoryAvg[cat]) categoryAvg[cat] = [];
      categoryAvg[cat].push(amt);
    }
  }
  const categoryStats = Object.entries(categoryAvg).map(([cat, amts]) => ({
    cat,
    avg: amts.reduce((s, v) => s + v, 0) / amts.length,
    count: amts.length,
  })).sort((a, b) => b.avg - a.avg);

  // 预测范围
  const predictedMin = Math.round(avgExpense * 0.85);
  const predictedMax = Math.round(avgExpense * 1.15);

  const userPrompt = [
    '【历史数据】',
    ...recentMonths.map(m => {
      const cats = Object.entries(m.byCategory || {}).slice(0, 3)
        .map(([c, a]) => `${c} ¥${a.toFixed(0)}`).join('、');
      return `${m.month}：支出 ¥${m.expense.toFixed(0)}，收入 ¥${m.income.toFixed(0)}，主要去向：${cats || '无'}`;
    }),
    '',
    '【趋势分析】',
    `- 近 ${recentMonths.length} 月平均支出：¥${avgExpense.toFixed(0)}`,
    `- 最近一月支出：¥${lastExpense.toFixed(0)}`,
    `- 环比变化：${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
    `- 预测下月范围：¥${predictedMin} - ¥${predictedMax}`,
    '',
    '【分类排名（近3月均值）】',
    ...categoryStats.slice(0, 5).map(s =>
      `- ${s.cat}：月均 ¥${s.avg.toFixed(0)}`
    ),
  ].join('\n');

  const result = await callAiApi({
    system: PREDICTION_SYSTEM_PROMPT,
    userMessage: userPrompt,
    temperature: 0.3,
    maxTokens: 500,
  });

  if (!result.ok) return result;

  const data = {
    avgExpense,
    predictedMin,
    predictedMax,
    trend,
    topCategories: categoryStats.slice(0, 5),
  };

  await setPredictionCache({ content: result.content, data });
  return { ok: true, content: result.content, cached: false, data };
}

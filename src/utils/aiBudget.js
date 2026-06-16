// 小璐记账 · AI 预算建议生成器
// 分析过去几个月的消费数据，为每个支出分类推荐合理的月度预算
import { callAiApi } from './aiClient';

// AI 系统提示词：要求仅输出 JSON 数组
const BUDGET_SYSTEM_PROMPT = `你是一名专业的个人理财助手。根据用户过去几个月的消费数据，为每个支出分类推荐合理的月度预算。

要求：
- 仅输出 JSON 数组，不要任何其他文字
- 格式: [{"category":"分类名","suggested":数字,"reason":"简短理由"}]
- suggested 金额应为正整数，建议值介于过去月均的 80%-110% 之间
- 对于消费较稳定的分类，推荐接近月均值
- 对于波动大的分类，可以建议适当留余量
- 忽略金额很小的分类（月均<50元）
- 每个 reason 不超过 10 个字`;

/**
 * 纯本地算法：根据历史数据生成预算建议（AI 未配置时的兜底方案）
 *
 * 算法逻辑：
 * 1. 汇总每个分类在各月的支出
 * 2. 计算月均支出
 * 3. 月均 × 1.05（留 5% 缓冲）
 * 4. 四舍五入到最近的 10
 * 5. 排除总消费 < 50 的分类
 *
 * @param {Array<{ byCategory: Object, expense: number }>} pastSummaries - 过去几个月的摘要
 * @returns {Array<{ category: string, suggested: number, average: number, trend: string }>}
 */
function generateFallbackSuggestions(pastSummaries) {
  if (!pastSummaries || pastSummaries.length === 0) return [];

  const monthCount = pastSummaries.length;

  // 按分类汇总每月支出
  // categoryTotals: { "餐饮": [1200, 1350, 1100], ... }
  const categoryTotals = {};
  for (const summary of pastSummaries) {
    if (!summary.byCategory) continue;
    for (const [cat, amt] of Object.entries(summary.byCategory)) {
      if (!categoryTotals[cat]) categoryTotals[cat] = [];
      categoryTotals[cat].push(amt);
    }
  }

  const suggestions = [];

  for (const [category, amounts] of Object.entries(categoryTotals)) {
    // 计算该分类的总支出，排除太小的分类
    const total = amounts.reduce((a, b) => a + b, 0);
    if (total < 50) continue;

    // 月均支出（按有数据的月份数计算）
    const average = total / monthCount;

    // 推荐金额：月均 × 1.05，四舍五入到 10
    const suggested = Math.round((average * 1.05) / 10) * 10;

    // 趋势判断：比较最近月与最早月
    let trend = 'stable';
    if (amounts.length >= 2) {
      const first = amounts[0];
      const last = amounts[amounts.length - 1];
      if (first > 0) {
        const changeRate = (last - first) / first;
        if (changeRate > 0.15) trend = 'increasing';
        else if (changeRate < -0.15) trend = 'decreasing';
      }
    }

    suggestions.push({
      category,
      suggested: Math.max(suggested, 10), // 最少推荐 10 元
      average: Math.round(average * 100) / 100,
      trend,
    });
  }

  // 按推荐金额降序排列
  suggestions.sort((a, b) => b.suggested - a.suggested);
  return suggestions;
}

/**
 * 将历史摘要数据格式化为 AI 可读的文本
 * @param {Array} pastSummaries
 * @param {string} currency
 * @returns {string}
 */
function buildBudgetPrompt(pastSummaries, currency) {
  const lines = [];
  lines.push('货币单位：' + currency);
  lines.push('共 ' + pastSummaries.length + ' 个月的历史数据：');
  lines.push('');

  pastSummaries.forEach((summary, i) => {
    const monthLabel = '第 ' + (i + 1) + ' 个月';
    lines.push(monthLabel + '（总支出：' + summary.expense.toFixed(2) + '）');

    if (summary.byCategory) {
      // 按金额降序排列分类
      const sorted = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
      for (const [cat, amt] of sorted) {
        lines.push('  - ' + cat + '：' + amt.toFixed(2));
      }
    }
    lines.push('');
  });

  lines.push('请根据以上数据，为每个主要支出分类推荐月度预算。');
  return lines.join('\n');
}

/**
 * 尝试从 AI 返回的文本中解析 JSON 数组
 * 兼容 AI 可能输出 markdown 代码块包裹的情况
 * @param {string} text
 * @returns {Array|null}
 */
function parseAiJson(text) {
  if (!text) return null;

  // 先尝试直接解析
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr;
  } catch {}

  // 尝试去除 markdown 代码块
  const stripped = text.replace(/^```(?:json)?\n?([\s\S]*?)\n?```\s*$/, '$1').trim();
  try {
    const arr = JSON.parse(stripped);
    if (Array.isArray(arr)) return arr;
  } catch {}

  // 尝试提取第一个 [ ... ] 区间
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }

  return null;
}

/**
 * 为趋势标签生成中文描述
 * @param {string} trend
 * @returns {string}
 */
function trendLabel(trend) {
  switch (trend) {
    case 'increasing':
      return '上升趋势';
    case 'decreasing':
      return '下降趋势';
    default:
      return '基本稳定';
  }
}

/**
 * 生成预算建议（主入口）
 *
 * 优先使用 AI 生成建议；若 AI 未配置或调用失败，则回退到本地算法。
 *
 * @param {Object} params
 * @param {Array<{ byCategory: Object, expense: number }>} params.pastSummaries - 过去几个月的摘要
 * @param {string} [params.currency='CNY'] - 货币单位
 * @returns {Promise<{ ok: boolean, suggestions?: Array, error?: string }>}
 */
export async function generateBudgetSuggestions({ pastSummaries, currency = 'CNY' }) {
  // 参数校验
  if (!pastSummaries || pastSummaries.length === 0) {
    return { ok: false, error: '没有可用的历史消费数据' };
  }

  // 先计算本地兜底建议
  const fallbackSuggestions = generateFallbackSuggestions(pastSummaries);
  if (fallbackSuggestions.length === 0) {
    return { ok: false, error: '历史数据中无有效支出分类' };
  }

  // 尝试用 AI 生成建议
  const userPrompt = buildBudgetPrompt(pastSummaries, currency);
  const result = await callAiApi({
    system: BUDGET_SYSTEM_PROMPT,
    userMessage: userPrompt,
    temperature: 0.3,
    maxTokens: 800,
  });

  if (!result.ok) {
    // AI 未配置或调用失败，降级到本地算法
    return { ok: true, suggestions: fallbackSuggestions, source: 'local' };
  }

  // 解析 AI 返回的 JSON
  const aiResults = parseAiJson(result.content);
  if (!aiResults || aiResults.length === 0) {
    return { ok: true, suggestions: fallbackSuggestions, source: 'local' };
  }

  // 将 AI 结果标准化为统一格式
  const suggestions = aiResults.map((item) => {
    const localMatch = fallbackSuggestions.find((s) => s.category === item.category);
    return {
      category: item.category || '',
      suggested: Math.max(Math.round(Number(item.suggested) || 0), 10),
      average: localMatch ? localMatch.average : 0,
      trend: localMatch ? localMatch.trend : 'stable',
      reason: item.reason || '',
    };
  });

  suggestions.sort((a, b) => b.suggested - a.suggested);
  return { ok: true, suggestions, source: 'ai' };
}

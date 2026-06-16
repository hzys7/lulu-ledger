// 璐璐记账 · AI 消费心情分析
// 分析用户某周期的消费心情数据，生成洞察报告
import { callAiApi } from './aiClient';
import { getCache, setCache } from './aiCache';
import { MOOD_LABELS, MOOD_EMOJIS } from './aiMoodShared';

const MOOD_SYSTEM_PROMPT = `你是一位亲切的个人理财助手"小璐"。基于用户提供的消费心情数据，分析用户最近的消费心理状态，给出有洞察力的分析。

输出要求：
- 仅输出纯文本，不要 Markdown 格式
- 不要任何前缀说明（不要写"好的"、"以下是"等开场白）
- 控制在 120 字以内
- 用中文，语气亲切友好
- 可以适当使用 emoji 让表达更生动

分析重点：
1. 整体消费情绪倾向——这周期消费时的心情主基调是什么？
2. 值得注意的行为模式——有没有什么有趣或值得警惕的模式？
3. 简短建议——1句话 actionable 建议

注意：如果用户标记为"滴血"、"后悔"或"手滑"的消费占比较高，应温和提醒注意冲动消费。`;



function cacheKey(period, label) {
  return 'lulu_mood_analysis_' + period + '_' + label;
}

export async function getCachedMoodAnalysis(period, label) {
  return getCache(cacheKey(period, label));
}

async function setCachedMoodAnalysis(period, label, data) {
  await setCache(cacheKey(period, label), data);
}

/**
 * 生成消费心情 AI 分析
 * @param {Object} params
 * @param {string} params.period - 'week' | 'month' | 'year'
 * @param {string} params.periodLabel - 显示用的周期名，如"本周"、"3月"、"2025年"
 * @param {Array} params.moodItems - moodStats.items 格式：{ key, label, emoji, count, pct }[]
 * @param {number} params.totalTransactions - 有心情标记的总交易笔数
 * @param {number} params.totalAmount - 该周期总支出金额
 * @param {Array} params.topExpenses - [{ category, amount, mood, note, date }] 该周期内高额交易
 * @param {string} params.currency - 货币代码
 * @param {boolean} params.forceRegenerate - 是否强制重新生成
 */
export async function analyzeMood({
  period, periodLabel, moodItems, totalTransactions, totalAmount,
  topExpenses = [], currency = 'CNY', forceRegenerate = false,
}) {
  if (!forceRegenerate) {
    const cached = await getCachedMoodAnalysis(period, periodLabel);
    if (cached && cached.content) {
      return { ok: true, content: cached.content, cached: true };
    }
  }

  // 构建心情分布描述
  const moodLines = moodItems
    .filter(m => m.key !== '')
    .map(m => {
      const emoji = MOOD_EMOJIS[m.key] || '';
      const label = MOOD_LABELS[m.key] || m.key;
      return `- ${emoji} ${label}：${m.count}笔 (${m.pct}%)`;
    });

  const topLines = topExpenses.slice(0, 5).map(t => {
    const d = new Date(t.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const moodLabel = MOOD_LABELS[t.mood] || t.mood || '未标记';
    return `- ¥${t.amount.toFixed(2)} ${t.category} · ${moodLabel}${t.note ? ' · ' + t.note : ''} ${dateStr}`;
  });

  const userPrompt = [
    '【分析周期】' + periodLabel,
    '【周期总支出】¥' + (totalAmount || 0).toFixed(2),
    '【有心情标记的交易】' + totalTransactions + '笔',
    '',
    '【心情分布】',
    ...(moodLines.length > 0 ? moodLines : ['- 暂无已标记心情的交易']),
    '',
    '【高额交易】',
    ...(topLines.length > 0 ? topLines : ['- 无']),
    '',
    '请分析用户的消费心理状态。',
  ].join('\n');

  const result = await callAiApi({
    system: MOOD_SYSTEM_PROMPT,
    userMessage: userPrompt,
    temperature: 0.5,
    maxTokens: 300,
  });

  if (!result.ok) return result;

  let content = result.content;
  content = content.replace(/^```[\s\S]*?```/, '').trim();

  await setCachedMoodAnalysis(period, periodLabel, { content, generatedAt: new Date().toISOString() });
  return { ok: true, content, cached: false };
}

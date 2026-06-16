// 小璐记账 · AI 消费心理深度分析
// 结合心情数据和消费行为，分析消费动机和情绪模式
import { callAiApi } from './aiClient';
import { getCache, setCache } from './aiCache';
import { MOOD_LABELS, MOOD_EMOJIS } from './aiMoodShared';

const MINDSET_SYSTEM_PROMPT = `你是一名消费心理学顾问，名字叫"小璐"。请基于用户的消费数据和心情标记，分析其消费心理模式。

输出要求：
- 仅输出纯文本，不要 Markdown 格式
- 不要任何前缀说明
- 控制在 180 字以内
- 用中文，语气温暖理解，不要说教
- 可以使用 emoji

分析重点：
1. 消费情绪画像——用户的主要消费情绪是什么？
2. 行为模式——有没有重复出现的消费模式（如"心情不好就买奶茶"）
3. 潜在风险——如果发现冲动消费倾向，温和指出
4. 一个正向建议——帮助用户建立更健康的消费心态

注意：
- 不要给用户贴负面标签
- 用"你可能..."而不是"你总是..."
- 如果数据不足，简单说明并鼓励继续记录`;

function cacheKey(period, label) {
  return `ai_mindset_${period}_${label}`;
}

/**
 * 获取缓存的心理分析
 */
export async function getCachedMindsetAnalysis(period, label) {
  return getCache(cacheKey(period, label));
}

/**
 * 生成消费心理深度分析
 * @param {Object} params
 * @param {string} params.period - 'week' | 'month' | 'year'
 * @param {string} params.periodLabel - 显示用的周期名
 * @param {Array} params.transactions - 该周期的交易记录（含心情标记）
 * @param {Object} params.moodDistribution - 心情分布 { key: count }
 * @param {Array} params.topExpenses - 高额交易 [{ amount, category, mood, note, date }]
 * @param {string} params.currency
 * @param {boolean} params.forceRegenerate
 */
export async function analyzeMindset({
  period,
  periodLabel,
  transactions = [],
  moodDistribution = {},
  topExpenses = [],
  currency = 'CNY',
  forceRegenerate = false,
}) {
  if (!forceRegenerate) {
    const cached = await getCachedMindsetAnalysis(period, periodLabel);
    if (cached && cached.content) {
      return { ok: true, content: cached.content, cached: true };
    }
  }

  const expenseTxs = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenseTxs.reduce((s, t) => s + t.amount, 0);

  // 分析心情与消费的关系
  const moodExpenseMap = {};
  for (const t of expenseTxs) {
    const mood = t.mood || 'unmarked';
    if (!moodExpenseMap[mood]) moodExpenseMap[mood] = { count: 0, total: 0 };
    moodExpenseMap[mood].count++;
    moodExpenseMap[mood].total += t.amount;
  }

  // 找出"高消费心情"——金额占比高于笔数占比的心情
  const moodInsights = [];
  for (const [mood, data] of Object.entries(moodExpenseMap)) {
    if (mood === 'unmarked') continue;
    const countPct = data.count / expenseTxs.length;
    const amountPct = data.total / totalExpense;
    if (amountPct > countPct * 1.2) {
      moodInsights.push({
        mood,
        label: MOOD_LABELS[mood] || mood,
        emoji: MOOD_EMOJIS[mood] || '',
        avgAmount: data.total / data.count,
        ratio: amountPct / countPct,
      });
    }
  }
  moodInsights.sort((a, b) => b.ratio - a.ratio);

  // 分析时间模式
  const hourDistribution = new Array(24).fill(0);
  const dayDistribution = new Array(7).fill(0);
  for (const t of expenseTxs) {
    const d = new Date(t.date);
    hourDistribution[d.getHours()]++;
    dayDistribution[d.getDay()]++;
  }
  const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));
  const peakDay = dayDistribution.indexOf(Math.max(...dayDistribution));
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 构建分析 prompt
  const moodLines = Object.entries(moodDistribution)
    .filter(([k]) => k !== '')
    .map(([k, count]) => {
      const label = MOOD_LABELS[k] || k;
      const emoji = MOOD_EMOJIS[k] || '';
      const data = moodExpenseMap[k];
      const avg = data ? (data.total / data.count).toFixed(0) : '0';
      return `- ${emoji} ${label}：${count}笔，平均 ¥${avg}`;
    });

  const topLines = topExpenses.slice(0, 3).map(t => {
    const moodLabel = MOOD_LABELS[t.mood] || t.mood || '未标记';
    return `- ¥${t.amount.toFixed(0)} ${t.category}（${moodLabel}）`;
  });

  const userPrompt = [
    `【分析周期】${periodLabel}`,
    `【总支出】¥${totalExpense.toFixed(0)}（${expenseTxs.length}笔）`,
    '',
    '【心情分布】',
    ...moodLines,
    '',
    '【高额消费】',
    ...topLines,
    '',
    '【时间模式】',
    `- 高峰时段：${peakHour}:00-${peakHour + 1}:00`,
    `- 高峰日：${dayNames[peakDay]}`,
    '',
    '【高消费心情】（金额占比高于笔数占比的心情）',
    ...moodInsights.slice(0, 2).map(i =>
      `- ${i.emoji} ${i.label}：平均消费 ¥${i.avgAmount.toFixed(0)}，是普通消费的 ${i.ratio.toFixed(1)} 倍`
    ),
  ].join('\n');

  const result = await callAiApi({
    system: MINDSET_SYSTEM_PROMPT,
    userMessage: userPrompt,
    temperature: 0.5,
    maxTokens: 600,
  });

  if (result.ok) {
    await setCache(cacheKey(period, periodLabel), { content: result.content });
  }

  return result;
}

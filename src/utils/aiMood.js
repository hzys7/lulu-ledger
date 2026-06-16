// 璐璐记账 · AI 消费心情分析
// 分析用户某周期的消费心情数据，生成洞察报告
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const MOOD_LABELS_MAP = {
  '': '未标记', happy: '快乐', impulse: '手滑', regret: '踩坑',
  necessary: '必要', reward: '犒劳', painful: '滴血',
  satisfied: '真香', remorse: '后悔', neutral: '无感', worthit: '值了',
};
const MOOD_EMOJIS_MAP = {
  '': '—', happy: '🥳', impulse: '🫣', regret: '💣',
  necessary: '🤷', reward: '🍗', painful: '🩸',
  satisfied: '✨', remorse: '🫠', neutral: '〰️', worthit: '💯',
};

function cacheKey(period, label) {
  return 'lulu_mood_analysis_' + period + '_' + label;
}

export async function getCachedMoodAnalysis(period, label) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(period, label));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

async function setCachedMoodAnalysis(period, label, data) {
  try {
    await AsyncStorage.setItem(cacheKey(period, label), JSON.stringify(data));
  } catch {}
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
  const config = await loadAiConfig();
  if (!config.apiKey) return { ok: false, error: '未配置 AI' };
  if (!config.enabled) return { ok: false, error: 'AI 未启用' };

  if (!forceRegenerate) {
    const cached = await getCachedMoodAnalysis(period, periodLabel);
    if (cached && cached.content) {
      return { ok: true, content: cached.content, cached: true };
    }
  }

  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) return { ok: false, error: '接口地址未配置' };
  const model = config.model === '__custom__' ? config.customModel : config.model;
  if (!model) return { ok: false, error: '模型未配置' };

  // 构建心情分布描述
  const moodLines = moodItems
    .filter(m => m.key !== '') // 排除"未标记"
    .map(m => {
      const emoji = MOOD_EMOJIS_MAP[m.key] || '';
      const label = MOOD_LABELS_MAP[m.key] || m.key;
      return `- ${emoji} ${label}：${m.count}笔 (${m.pct}%)`;
    });

  // 高额交易
  const topLines = topExpenses.slice(0, 5).map(t => {
    const d = new Date(t.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const moodLabel = MOOD_LABELS_MAP[t.mood] || t.mood || '未标记';
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

  try {
    const res = await fetch(baseURL + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: MOOD_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效' };
      if (res.status === 429) return { ok: false, error: '请求过快' };
      return { ok: false, error: 'HTTP ' + res.status };
    }

    const json = await res.json();
    let content = json?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'AI 返回为空' };
    content = String(content).trim();
    content = content.replace(/^```[\s\S]*?```/, '').trim();

    await setCachedMoodAnalysis(period, periodLabel, { content, generatedAt: new Date().toISOString() });
    return { ok: true, content, cached: false };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || '').substring(0, 80) };
  }
}

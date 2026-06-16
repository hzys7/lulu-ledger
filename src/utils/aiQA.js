// 璐璐记账 · AI 对话式财务问答
// 构建当前财务上下文，支持多轮对话，回答关于消费/收入的问题。
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';

const QA_SYSTEM_PROMPT = `你是一名亲切、专业的个人理财助手，名字叫"小璐"。你需要基于用户的真实账目数据，用简洁友好的中文回答财务相关问题。

回答要求：
- 简洁直接，避免冗长。一般 2-4 句话回答清楚
- 用具体数字说话，引用账目中的真实数据
- 可以适当用 emoji 让回答更友好，但不要过多
- 如果用户问的数据超出提供的上下文，如实说明"根据目前的数据…"
- 给建议时要具体可执行，不要泛泛而谈
- 不要使用 Markdown 格式，用纯文本回答

当前日期：{NOW}`;

/**
 * 构建财务上下文摘要
 * @param {Object} params
 * @param {Array} params.transactions - 当月交易
 * @param {Array} params.lastMonthTxs - 上月交易
 * @param {Object} params.summary - 当月汇总 { income, expense, balance, byCategory, incomeByCategory, transactionCount }
 * @param {Object} params.lastSummary - 上月汇总
 * @param {string} params.currency
 * @param {Array} params.budgets - 当月预算
 */
export function buildFinancialContext({ transactions, summary, lastSummary, currency, budgets }) {
  const lines = [];
  lines.push('=== 用户账目数据 ===');
  lines.push('');

  // 当月概览
  lines.push('【当月概览】');
  lines.push('总支出：' + summary.expense.toFixed(2) + ' ' + currency);
  lines.push('总收入：' + summary.income.toFixed(2) + ' ' + currency);
  lines.push('结余：' + (summary.income - summary.expense).toFixed(2) + ' ' + currency);
  lines.push('交易笔数：' + summary.transactionCount);
  const days = new Date().getDate();
  lines.push('日均支出：' + (days > 0 ? (summary.expense / days).toFixed(2) : '0') + ' ' + currency);
  lines.push('');

  // 支出分类
  if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
    lines.push('【支出分类明细（按金额降序）】');
    const sorted = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) {
      const pct = summary.expense > 0 ? ((amt / summary.expense) * 100).toFixed(1) : '0';
      lines.push('- ' + cat + '：' + amt.toFixed(2) + '（' + pct + '%）');
    }
    lines.push('');
  }

  // 收入分类
  if (summary.incomeByCategory && Object.keys(summary.incomeByCategory).length > 0) {
    lines.push('【收入分类明细】');
    const sorted = Object.entries(summary.incomeByCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) {
      lines.push('- ' + cat + '：' + amt.toFixed(2));
    }
    lines.push('');
  }

  // 上月对比
  if (lastSummary) {
    lines.push('【上月对比】');
    lines.push('上月支出：' + lastSummary.expense.toFixed(2));
    lines.push('上月收入：' + lastSummary.income.toFixed(2));
    if (lastSummary.expense > 0) {
      const diff = ((summary.expense - lastSummary.expense) / lastSummary.expense) * 100;
      lines.push('支出环比：' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%');
    }
    lines.push('');
  }

  // 预算
  if (budgets && budgets.length > 0) {
    lines.push('【当月预算】');
    for (const b of budgets) {
      const spent = summary.byCategory?.[b.category] || 0;
      const remain = b.amount - spent;
      const pct = b.amount > 0 ? ((spent / b.amount) * 100).toFixed(0) : '0';
      lines.push('- ' + b.category + '：预算 ' + b.amount.toFixed(2) + '，已花 ' + spent.toFixed(2) + '（' + pct + '%），剩余 ' + remain.toFixed(2));
    }
    lines.push('');
  }

  // 最近 15 笔交易
  const recent = (transactions || []).slice(0, 15);
  if (recent.length > 0) {
    lines.push('【最近 ' + recent.length + ' 笔交易】');
    for (const t of recent) {
      const d = new Date(t.date);
      const dateStr = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
      const sign = t.type === 'expense' ? '-' : '+';
      lines.push('- ' + dateStr + ' ' + sign + t.amount.toFixed(2) + ' ' + t.category + (t.note ? ' · ' + t.note : ''));
    }
    lines.push('');
  }

  // 支出 TOP5 单笔
  const topExp = (transactions || [])
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  if (topExp.length > 0) {
    lines.push('【当月最高 5 笔支出】');
    for (const t of topExp) {
      const d = new Date(t.date);
      const dateStr = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
      lines.push('- ' + dateStr + ' ' + t.category + ' ' + t.amount.toFixed(2) + (t.note ? ' · ' + t.note : ''));
    }
  }

  return lines.join('\n');
}

/**
 * 发送一条对话消息，返回 AI 回答
 * @param {Object} params
 * @param {string} params.userMessage - 用户消息
 * @param {Array} params.history - 之前的对话记录 [{role, content}]
 * @param {string} params.contextText - 财务上下文文本（由 buildFinancialContext 生成）
 * @returns {Promise<{ ok: boolean, reply?: string, error?: string }>}
 */
export async function askFinanceQuestion({ userMessage, history = [], contextText = '' }) {
  const config = await loadAiConfig();
  if (!config.apiKey) return { ok: false, error: '未配置 API Key' };
  if (!config.enabled) return { ok: false, error: 'AI 功能未启用' };

  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) return { ok: false, error: '接口地址未配置' };
  const model = config.model === '__custom__' ? config.customModel : config.model;
  if (!model) return { ok: false, error: '模型未配置' };

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  let systemPrompt = QA_SYSTEM_PROMPT.replace('{NOW}', dateStr + ' 周' + weekDay);

  if (contextText) {
    systemPrompt += '\n\n' + contextText;
  }

  // 构建消息列表：system + 历史 + 当前消息
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10), // 最多保留最近 10 轮对话
    { role: 'user', content: userMessage },
  ];

  try {
    const res = await fetch(baseURL + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.5,
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效（401）' };
      if (res.status === 402) return { ok: false, error: '余额不足（402）' };
      if (res.status === 429) return { ok: false, error: '请求过快（429）' };
      return { ok: false, error: 'HTTP ' + res.status + (errText ? '：' + errText.substring(0, 100) : '') };
    }
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) return { ok: false, error: 'AI 返回内容为空' };
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 100) };
  }
}

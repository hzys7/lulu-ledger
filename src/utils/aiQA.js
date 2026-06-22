// 小璐记账 · AI 对话式财务问答（增强版）
// 支持流式输出、动态快捷问题、追问建议、更丰富的上下文
import { callAiApi } from './aiClient';

const QA_SYSTEM_PROMPT = `你是一名亲切、专业的个人理财助手，名字叫"小璐"。你需要基于用户的真实账目数据，用简洁友好的中文回答财务相关问题。

回答要求：
- 简洁直接，避免冗长。一般 2-4 句话回答清楚
- 用具体数字说话，引用账目中的真实数据
- 可以适当用 emoji 让回答更友好，但不要过多
- 如果用户问的数据超出提供的上下文，如实说明"根据目前的数据…"
- 给建议时要具体可执行，不要泛泛而谈
- 不要使用 Markdown 格式，用纯文本回答
- 分析消费趋势时，指出变化方向和可能原因
- 发现异常消费时主动提醒
- 给出省钱建议时要结合用户的实际消费习惯

当前日期：{NOW}`;

/**
 * 构建财务上下文摘要（增强版）
 */
export function buildFinancialContext({ transactions, summary, lastSummary, last3MonthSummary, currency, budgets, accounts }) {
  const lines = [];
  lines.push('=== 用户账目数据 ===');
  lines.push('');

  // 当月概览
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  
  lines.push('【当月概览】');
  lines.push('总支出：' + summary.expense.toFixed(2) + '元');
  lines.push('总收入：' + summary.income.toFixed(2) + '元');
  lines.push('结余：' + (summary.income - summary.expense).toFixed(2) + '元');
  lines.push('交易笔数：' + summary.transactionCount);
  lines.push('日均支出：' + (dayOfMonth > 0 ? (summary.expense / dayOfMonth).toFixed(2) : '0') + '元');
  lines.push('预测月底支出：' + (dayOfMonth > 0 ? (summary.expense / dayOfMonth * daysInMonth).toFixed(2) : '0') + '元');
  lines.push('本月还剩：' + daysLeft + '天');
  if (dayOfMonth > 0 && daysLeft > 0) {
    const dailyBudget = (summary.income - summary.expense) / daysLeft;
    lines.push('剩余日均可用：' + dailyBudget.toFixed(2) + '元');
  }
  lines.push('');

  // 支出分类
  if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
    lines.push('【支出分类明细（按金额降序）】');
    const sorted = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) {
      const pct = summary.expense > 0 ? ((amt / summary.expense) * 100).toFixed(1) : '0';
      const dailyAmt = dayOfMonth > 0 ? (amt / dayOfMonth).toFixed(2) : '0';
      lines.push('- ' + cat + '：' + amt.toFixed(2) + '元（' + pct + '%），日均 ' + dailyAmt + '元');
    }
    lines.push('');
  }

  // 收入分类
  if (summary.incomeByCategory && Object.keys(summary.incomeByCategory).length > 0) {
    lines.push('【收入分类明细】');
    const sorted = Object.entries(summary.incomeByCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) {
      lines.push('- ' + cat + '：' + amt.toFixed(2) + '元');
    }
    lines.push('');
  }

  // 消费趋势（近3个月）
  if (last3MonthSummary && last3MonthSummary.length >= 2) {
    lines.push('【近3个月消费趋势】');
    for (const m of last3MonthSummary) {
      lines.push('- ' + m.label + '：支出 ' + m.expense.toFixed(2) + '元，收入 ' + m.income.toFixed(2) + '元');
    }
    // 计算趋势
    if (last3MonthSummary.length >= 2) {
      const recent = last3MonthSummary[last3MonthSummary.length - 1].expense;
      const prev = last3MonthSummary[last3MonthSummary.length - 2].expense;
      if (prev > 0) {
        const change = ((recent - prev) / prev * 100).toFixed(1);
        lines.push('支出趋势：较上月' + (change >= 0 ? '增加' : '减少') + Math.abs(change) + '%');
      }
    }
    lines.push('');
  }

  // 上月对比
  if (lastSummary) {
    lines.push('【上月对比】');
    lines.push('上月支出：' + lastSummary.expense.toFixed(2) + '元');
    lines.push('上月收入：' + lastSummary.income.toFixed(2) + '元');
    if (lastSummary.expense > 0) {
      const diff = ((summary.expense - lastSummary.expense) / lastSummary.expense) * 100;
      lines.push('支出环比：' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%');
      if (Math.abs(diff) > 20) {
        lines.push('注意：支出变化较大，请关注');
      }
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
      const status = spent > b.amount ? '⚠️ 已超支' : (parseFloat(pct) > 80 ? '⚡ 快用完' : '✅ 正常');
      lines.push('- ' + b.category + '：预算 ' + b.amount.toFixed(2) + '元，已花 ' + spent.toFixed(2) + '元（' + pct + '%），剩余 ' + remain.toFixed(2) + '元 ' + status);
    }
    lines.push('');
  }

  // 账户余额
  if (accounts && accounts.length > 0) {
    lines.push('【账户余额】');
    for (const a of accounts) {
      lines.push('- ' + a.name + '（' + a.type + '）：' + a.balance.toFixed(2) + '元');
    }
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    lines.push('总资产：' + totalBalance.toFixed(2) + '元');
    lines.push('');
  }

  // 最近 20 笔交易
  const recent = (transactions || []).slice(0, 20);
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
      lines.push('- ' + dateStr + ' ' + t.category + ' ' + t.amount.toFixed(2) + '元' + (t.note ? ' · ' + t.note : ''));
    }
    lines.push('');
  }

  // 消费习惯分析
  if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
    const sorted = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const topCat = sorted[0];
      const topPct = summary.expense > 0 ? ((topCat[1] / summary.expense) * 100).toFixed(0) : '0';
      lines.push('【消费习惯】');
      lines.push('最大支出类别：' + topCat[0] + '，占总支出 ' + topPct + '%');
      if (parseFloat(topPct) > 40) {
        lines.push('注意：' + topCat[0] + '占比偏高，建议关注');
      }
    }
  }

  return lines.join('\n');
}

/**
 * 生成动态快捷问题
 */
export function generateQuickQuestions({ summary, lastSummary, budgets, accounts }) {
  const questions = [];
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  // 基础问题
  if (summary.expense > 0) {
    questions.push('这个月花了多少钱？');
  }
  
  // 分类相关
  if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
    const sorted = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      questions.push('哪项支出最多？');
    }
    if (sorted.length >= 2) {
      questions.push(sorted[0][0] + '为什么花这么多？');
    }
  }
  
  // 对比相关
  if (lastSummary && lastSummary.expense > 0) {
    questions.push('跟上月比怎么样？');
    const diff = ((summary.expense - lastSummary.expense) / lastSummary.expense * 100).toFixed(0);
    if (Math.abs(diff) > 10) {
      questions.push(diff > 0 ? '为什么这个月花多了？' : '这个月省钱了？');
    }
  }
  
  // 预算相关
  if (budgets && budgets.length > 0) {
    const overBudget = budgets.some(b => {
      const spent = summary.byCategory?.[b.category] || 0;
      return spent > b.amount;
    });
    if (overBudget) {
      questions.push('哪个分类超预算了？');
    } else {
      questions.push('预算还剩多少？');
    }
  }
  
  // 建议相关
  questions.push('有什么省钱建议吗？');
  
  if (dayOfMonth >= 15) {
    questions.push('这个月还能花多少？');
  }
  
  if (accounts && accounts.length > 0) {
    questions.push('我的资产情况如何？');
  }
  
  // 历史趋势
  questions.push('最近消费趋势怎么样？');
  
  // 返回最多6个问题
  return questions.slice(0, 6);
}

/**
 * 生成追问建议
 */
export function generateFollowUpSuggestions({ userMessage, aiReply, summary, lastSummary }) {
  const suggestions = [];
  const lowerMsg = (userMessage || '').toLowerCase();
  const lowerReply = (aiReply || '').toLowerCase();
  
  // 根据用户问题类型生成追问
  if (lowerMsg.includes('花') || lowerMsg.includes('支出') || lowerMsg.includes('消费')) {
    if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
      const topCat = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0][0];
      suggestions.push(topCat + '的详细构成是什么？');
    }
    suggestions.push('下个月预算建议怎么设？');
  }
  
  if (lowerMsg.includes('省') || lowerMsg.includes('建议')) {
    suggestions.push('具体怎么执行这个建议？');
    suggestions.push('哪些可以优先减少？');
  }
  
  if (lowerMsg.includes('预算')) {
    suggestions.push('预算超了怎么办？');
    suggestions.push('怎么调整更合理？');
  }
  
  if (lowerMsg.includes('收入') || lowerMsg.includes('赚')) {
    suggestions.push('收入结构合理吗？');
  }
  
  // 根据AI回答生成追问
  if (lowerReply.includes('超支') || lowerReply.includes('超标')) {
    suggestions.push('怎么控制这个支出？');
  }
  if (lowerReply.includes('趋势') || lowerReply.includes('变化')) {
    suggestions.push('接下来会怎样？');
  }
  
  // 默认追问
  if (suggestions.length === 0) {
    suggestions.push('还有其他建议吗？');
    if (lastSummary && lastSummary.expense > 0) {
      suggestions.push('对比去年同期呢？');
    }
  }
  
  // 去重并返回最多3个
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 3);
}

/**
 * 发送一条对话消息，返回 AI 回答
 */
export async function askFinanceQuestion({ userMessage, history = [], contextText = '' }) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  let systemPrompt = QA_SYSTEM_PROMPT.replace('{NOW}', dateStr + ' 周' + weekDay);

  if (contextText) {
    systemPrompt += '\n\n' + contextText;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ];

  const result = await callAiApi({ messages, temperature: 0.5, maxTokens: 600 });
  if (!result.ok) return result;
  return { ok: true, reply: result.content };
}

/**
 * 流式发送对话消息（支持打字机效果）
 */
export async function askFinanceQuestionStream({ userMessage, history = [], contextText = '', onChunk }) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  let systemPrompt = QA_SYSTEM_PROMPT.replace('{NOW}', dateStr + ' 周' + weekDay);

  if (contextText) {
    systemPrompt += '\n\n' + contextText;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ];

  const result = await callAiApi({ messages, temperature: 0.5, maxTokens: 600, onChunk });
  if (!result.ok) return result;
  return { ok: true, reply: result.content };
}

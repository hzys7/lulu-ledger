// 璐璐记账 · AI 月度复盘
// 读取某月的全部账目，调用 DeepSeek 生成中文 markdown 复盘报告。
import { callAiApi } from './aiClient';
import { getCache, setCache, removeCache } from './aiCache';

const REPORT_SYSTEM_PROMPT = `你是一名亲切、专业的个人理财助手，名字叫"小璐"。请基于用户提供的当月和上月账目数据，输出一份有洞察力的中文月度复盘报告。

输出要求：
- 仅输出 Markdown 文本，不要任何前缀说明（不要写"好的"、"以下是"等开场白）
- 不要使用代码块包裹
- 全文控制在 350 字以内
- 用中文，数字保留 2 位小数
- 可以使用 emoji 让排版更友好
- 语气像朋友聊天，避免空话套话
- 每条建议必须结合用户的具体数据，不要泛泛而谈

报告结构（5 段，用 ## 二级标题分隔）：

## 💰 本月一句话
用一句话概括本月财务健康状况，附上一个 1-10 分的健康评分（10 分最好）。
评分参考：结余为正且合理 → 7-9 分；收支平衡 → 5-6 分；超支或负债 → 3-4 分

## 📊 核心数据
- 总支出 / 总收入 / 结余
- 日均支出
- 与上月对比（用 ↑↓ 箭头标注百分比变化）
- 记账笔数

## 🔍 消费画像
- 支出 TOP 3 分类：名称、金额、占比
- 收入 TOP 2 来源（如有）
- 与上月相比变化最大的 1-2 个分类，说明原因（如"餐饮暴涨 40%，主要是外卖增加"）

## 💡 省钱机会
找出 1-2 个最有优化空间的分类，给出具体建议：
- 指出该分类当前金额和占比
- 给出一个合理的目标值（如"建议控制在 ¥XXX 以内"）
- 说明可以怎么做（如"减少外卖频次，每周带饭 2 天"）

## 🎯 下月行动
给出 2-3 条具体可执行的建议，每条不超过 20 字。不要说"合理消费"这种废话，要说"餐饮预算设 ¥1200，每周外卖不超过 3 次"这种。

注意：
- 如果当月数据太少（<5 笔），提醒用户多记账以获得更准确的分析
- 如果某个分类占比超过 40%，主动提醒"XX 占比过高，值得关注"
- 如果结余为负，温和提醒但不要制造焦虑`;

const MAX_TX_DETAIL = 80;

function buildReportPrompt({ year, month, currentTxs, lastTxs, summary, lastSummary, currency }) {
  const monthLabel = year + '-' + String(month + 1).padStart(2, '0');
  const lastLabel = lastSummary.year + '-' + String(lastSummary.month + 1).padStart(2, '0');

  const expenseByCategory = {};
  const incomeByCategory = {};
  for (const t of currentTxs) {
    if (t.type === 'expense') {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    } else {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    }
  }
  const expenseSorted = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
  const incomeSorted = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);

  const topExpense = [...currentTxs]
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const lines = [];
  lines.push('当前月份：' + monthLabel);
  lines.push('对比月份：' + lastLabel);
  lines.push('货币：' + currency);
  lines.push('');
  lines.push('【当月汇总】');
  lines.push('- 总支出：' + summary.expense.toFixed(2));
  lines.push('- 总收入：' + summary.income.toFixed(2));
  lines.push('- 结余：' + (summary.income - summary.expense).toFixed(2));
  lines.push('- 笔数：' + currentTxs.length);
  lines.push('');
  lines.push('【支出分类聚合（按金额降序）】');
  for (const [cat, amt] of expenseSorted) {
    const pct = summary.expense > 0 ? ((amt / summary.expense) * 100).toFixed(1) : '0';
    lines.push('- ' + cat + '：' + amt.toFixed(2) + ' （占 ' + pct + '%）');
  }
  if (incomeSorted.length > 0) {
    lines.push('');
    lines.push('【收入分类聚合】');
    for (const [cat, amt] of incomeSorted) {
      lines.push('- ' + cat + '：' + amt.toFixed(2));
    }
  }
  lines.push('');
  lines.push('【上月对比】');
  lines.push('- 上月总支出：' + lastSummary.expense.toFixed(2));
  lines.push('- 上月总收入：' + lastSummary.income.toFixed(2));
  if (lastSummary.expense > 0) {
    const diff = ((summary.expense - lastSummary.expense) / lastSummary.expense) * 100;
    lines.push('- 支出环比：' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%');
  }
  const lastExpenseByCategory = {};
  for (const t of lastTxs) {
    if (t.type === 'expense') {
      lastExpenseByCategory[t.category] = (lastExpenseByCategory[t.category] || 0) + t.amount;
    }
  }
  const allCats = new Set([...Object.keys(expenseByCategory), ...Object.keys(lastExpenseByCategory)]);
  const changes = [];
  for (const cat of allCats) {
    const cur = expenseByCategory[cat] || 0;
    const last = lastExpenseByCategory[cat] || 0;
    if (last > 0) {
      const diff = cur - last;
      const pct = (diff / last) * 100;
      if (Math.abs(pct) >= 20) {
        changes.push({ cat, cur, last, diff, pct });
      }
    } else if (cur >= 100) {
      changes.push({ cat, cur, last: 0, diff: cur, pct: 999 });
    }
  }
  changes.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  if (changes.length > 0) {
    lines.push('- 显著变化分类：');
    for (const c of changes.slice(0, 5)) {
      const sign = c.diff >= 0 ? '+' : '';
      lines.push('  - ' + c.cat + '：' + sign + c.diff.toFixed(2) + ' （' + (c.pct >= 999 ? '新增' : sign + c.pct.toFixed(0) + '%') + '）');
    }
  }
  lines.push('');
  lines.push('【当月 TOP 5 高额支出】');
  for (const t of topExpense) {
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    lines.push('- ' + dateStr + ' ' + t.category + ' ¥' + t.amount.toFixed(2) + (t.note ? ' · ' + t.note : ''));
  }
  if (currentTxs.length <= MAX_TX_DETAIL) {
    lines.push('');
    lines.push('【当月所有账目明细】');
    for (const t of currentTxs) {
      const d = new Date(t.date);
      const dateStr = d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
      const sign = t.type === 'expense' ? '-' : '+';
      lines.push('- ' + dateStr + ' ' + sign + t.amount.toFixed(2) + ' ' + t.category + (t.note ? ' · ' + t.note : ''));
    }
  }
  return lines.join('\n');
}

function cacheKey(year, month) {
  return 'ai_report_' + year + '_' + String(month + 1).padStart(2, '0');
}

export async function getCachedReport(year, month) {
  return getCache(cacheKey(year, month));
}

async function setCachedReport(year, month, data) {
  await setCache(cacheKey(year, month), data);
}

export async function clearCachedReport(year, month) {
  await removeCache(cacheKey(year, month));
}

export async function generateMonthlyReport({
  year, month, currentTxs, lastTxs, summary, lastSummary, currency, forceRegenerate = false,
}) {
  if (!forceRegenerate) {
    const cached = await getCachedReport(year, month);
    if (cached && cached.content) {
      return { ok: true, content: cached.content, cached: true, generatedAt: cached.generatedAt };
    }
  }

  const userPrompt = buildReportPrompt({ year, month, currentTxs, lastTxs, summary, lastSummary, currency });
  const result = await callAiApi({
    system: REPORT_SYSTEM_PROMPT,
    userMessage: userPrompt,
    temperature: 0.4,
    maxTokens: 1200,
  });

  if (!result.ok) return result;

  let content = result.content;
  content = content.replace(/^```(?:markdown|md)?\n?([\s\S]*?)\n?```\s*$/, '$1').trim();
  content = content.replace(/^```[\s\S]*?```/, '').trim();
  const generatedAt = new Date().toISOString();
  await setCachedReport(year, month, { content, generatedAt, txCount: currentTxs.length });
  return { ok: true, content, cached: false, generatedAt };
}
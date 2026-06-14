// 璐璐记账 · AI 月度复盘
// 读取某月的全部账目，调用 DeepSeek 生成中文 markdown 复盘报告。
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REPORT_SYSTEM_PROMPT = `你是一名亲切、专业的个人理财助手，名字叫"小璐"。请基于用户提供的当月和上月账目数据，输出一份简洁、可执行的中文月度复盘报告。

输出要求：
- 仅输出 Markdown 文本，不要任何前缀说明（不要写"好的"、"以下是"等开场白）
- 不要使用代码块包裹
- 全文控制在 400 字以内
- 用中文，数字保留 2 位小数
- 可以使用 emoji 让排版更友好
- 避免空话套话，给出具体数据和可执行建议

报告结构（4 段，用 ## 二级标题分隔）：

## 1. 本月概览
- 列出当月总支出、总收入、结余（收入 - 支出）
- 和上月对比，标注百分比变化（用 ↑ 或 ↓ 箭头）
- 给出日均支出金额

## 2. 主要去向
- 列出支出 TOP 3 分类（按金额降序），每个写：分类名、金额、占比百分比
- 如果有收入，列出收入 TOP 2 来源

## 3. 异常与亮点
- 找出相比上月变化最大的 1-2 个分类（暴涨或骤降），说明金额差异
- 找出金额最高的 1 笔账目（写明分类、金额、备注、日期）
- 如果当月没有明显异常，写"本月消费节奏稳定，无明显异常"

## 4. 下月建议
- 给出 2-3 条具体可执行的省钱或理财建议
- 不要泛泛而谈，要结合实际数据`;

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
  try {
    const raw = await AsyncStorage.getItem(cacheKey(year, month));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function setCachedReport(year, month, data) {
  try {
    await AsyncStorage.setItem(cacheKey(year, month), JSON.stringify(data));
  } catch (e) {}
}

export async function clearCachedReport(year, month) {
  try {
    await AsyncStorage.removeItem(cacheKey(year, month));
  } catch (e) {}
}

export async function generateMonthlyReport({
  year, month, currentTxs, lastTxs, summary, lastSummary, currency, forceRegenerate = false,
}) {
  const config = await loadAiConfig();
  if (!config.apiKey) return { ok: false, error: '未配置 API Key，请先在设置 → AI 配置中填写' };
  if (!config.enabled) return { ok: false, error: 'AI 功能未启用，请在设置 → AI 配置中打开开关' };

  if (!forceRegenerate) {
    const cached = await getCachedReport(year, month);
    if (cached && cached.content) {
      return { ok: true, content: cached.content, cached: true, generatedAt: cached.generatedAt };
    }
  }

  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) return { ok: false, error: '接口地址未配置' };
  const model = config.model === '__custom__' ? config.customModel : config.model;
  if (!model) return { ok: false, error: '模型未配置' };

  const userPrompt = buildReportPrompt({ year, month, currentTxs, lastTxs, summary, lastSummary, currency });
  try {
    const res = await fetch(baseURL + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: REPORT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效（401）' };
      if (res.status === 402) return { ok: false, error: '余额不足（402）' };
      if (res.status === 429) return { ok: false, error: '请求过快（429）' };
      return { ok: false, error: 'HTTP ' + res.status + (errText ? '：' + errText.substring(0, 120) : '') };
    }
    const json = await res.json();
    let content = json?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'AI 返回内容为空' };
    content = String(content).trim();
    content = content.replace(/^```(?:markdown|md)?\n?([\s\S]*?)\n?```\s*$/, '$1').trim();
    content = content.replace(/^```[\s\S]*?```/, '').trim();
    const generatedAt = new Date().toISOString();
    await setCachedReport(year, month, { content, generatedAt, txCount: currentTxs.length });
    return { ok: true, content, cached: false, generatedAt };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 120) };
  }
}
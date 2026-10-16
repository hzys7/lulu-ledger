// Generate a beautifully styled HTML report for PDF export.
// Used by shareReport.js to create a monthly or yearly financial summary.

import { formatMoney } from './currency';

const REPORT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #E0E5EC;
  color: #333A45;
  padding: 40px 32px;
}
.report { max-width: 640px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 32px; }
.header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: #333A45; }
.header .app-name { font-size: 13px; color: #6B7280; margin-top: 4px; }
.header .period { font-size: 14px; color: #6B7280; margin-top: 2px; }

.summary-grid {
  display: flex; gap: 16px; margin-bottom: 28px;
}
/* 新拟物：与背景同色 + 双光源阴影（左上高光 / 右下暗影） */
.summary-card {
  flex: 1; background: #E0E5EC; border-radius: 20px;
  padding: 20px 16px; text-align: center;
  box-shadow: 8px 8px 16px #B8BCC2, -8px -8px 16px #FFFFFF;
}
.summary-card .label { font-size: 12px; color: #6B7280; font-weight: 500; margin-bottom: 6px; }
.summary-card .value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
.summary-card .sub { font-size: 11px; color: #7C8593; margin-top: 4px; }

.section { margin-bottom: 28px; }
.section-title {
  font-size: 15px; font-weight: 600; color: #333A45;
  margin-bottom: 12px; letter-spacing: -0.3px;
}

.cat-table { width: 100%; border-collapse: collapse; }
.cat-table th {
  text-align: left; font-size: 11px; font-weight: 600; color: #6B7280;
  text-transform: uppercase; letter-spacing: 0.5px;
  padding-bottom: 8px; border-bottom: 1px solid rgba(184, 188, 194, 0.6);
}
.cat-table th:last-child { text-align: right; }
.cat-table td {
  padding: 8px 0; font-size: 14px; border-bottom: 1px solid rgba(184, 188, 194, 0.35);
}
.cat-table td:last-child { text-align: right; font-weight: 600; font-variant: tabular-nums; }
.cat-row .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 8px; }
.cat-total { font-weight: 700 !important; font-size: 15px !important; border-bottom: none !important; padding-top: 10px !important; }

.daily-chart { margin-top: 8px; }
.daily-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.daily-row .day-label { width: 24px; font-size: 11px; color: #7C8593; font-weight: 500; text-align: right; }
/* 凹陷槽：内阴影 */
.daily-row .bar-wrap {
  flex: 1; height: 14px; background: #DDE3EA; border-radius: 7px; overflow: hidden; display: flex;
  box-shadow: inset 2px 2px 5px #B8BCC2, inset -2px -2px 5px #FFFFFF;
}
.daily-row .bar-expense { height: 100%; background: #E5675F; border-radius: 7px; opacity: 0.9; }
.daily-row .bar-income { height: 100%; background: #2E9E6B; border-radius: 7px; opacity: 0.9; }
.daily-row .bar-empty { flex: 1; }

.transaction-list { margin-top: 8px; }
.tx-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 0; border-bottom: 1px solid rgba(184, 188, 194, 0.35); font-size: 13px;
}
.tx-item .tx-left { display: flex; align-items: center; gap: 8px; }
.tx-item .tx-dot { width: 6px; height: 6px; border-radius: 3px; }
.tx-item .tx-cat { font-weight: 500; }
.tx-item .tx-note { color: #7C8593; font-size: 11px; margin-left: 4px; }
.tx-item .tx-amount { font-weight: 600; font-variant: tabular-nums; }
.income { color: #2E9E6B; }
.expense { color: #333A45; }

.footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(184, 188, 194, 0.6); }
.footer p { font-size: 11px; color: #7C8593; }
`;

function catColor(name, catColors) {
  return catColors[name] || '#7C8593';
}

function catDot(name, catColors) {
  return `<span class="dot" style="background:${catColor(name, catColors)}"></span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCategoryKey(name, type) {
  return type === 'income' ? name + '(收入)' : name;
}

export function generateMonthlyReportHtml({
  year,
  month,
  totalIncome,
  totalExpense,
  balance,
  expenseByCategory,
  incomeByCategory,
  dailyExpense,
  dailyIncome,
  transactionCount,
  transactions,
  settings,
  catColors,
}) {
  const now = new Date();
  const currency = settings?.currency || 'CNY';
  const symbol = settings?.currency === 'CNY' ? '¥' : '$';
  const fm = (v) => formatMoney(v, currency);

  // Category breakdown
  const expenseCats = Object.entries(expenseByCategory || {}).sort((a, b) => b[1] - a[1]);
  const incomeCats = Object.entries(incomeByCategory || {}).sort((a, b) => b[1] - a[1]);

  // Daily chart rows
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let dailyRows = '';
  const maxExpense = Math.max(...Object.values(dailyExpense || {}), 1);
  const maxIncome = Math.max(...Object.values(dailyIncome || {}), 1);
  for (let d = 1; d <= daysInMonth; d++) {
    const exp = dailyExpense[d] || 0;
    const inc = dailyIncome[d] || 0;
    const expPct = (exp / maxExpense) * 100;
    const incPct = (inc / maxIncome) * 100;
    dailyRows += `
      <div class="daily-row">
        <span class="day-label">${d}</span>
        <div class="bar-wrap">
          ${exp > 0 ? `<div class="bar-expense" style="width:${expPct}%"></div>` : ''}
          ${inc > 0 ? `<div class="bar-income" style="width:${incPct}%"></div>` : ''}
          ${exp === 0 && inc === 0 ? '<div class="bar-empty"></div>' : ''}
        </div>
      </div>`;
  }

  // Recent transactions (top 20)
  let txRows = '';
  if (transactions && transactions.length > 0) {
    const recent = [...transactions].slice(0, 20);
    recent.forEach((t) => {
      const color = catColor(t.category, catColors);
      txRows += `
        <div class="tx-item">
          <div class="tx-left">
            <span class="tx-dot" style="background:${color}"></span>
            <span class="tx-cat">${escapeHtml(t.category)}</span>
            ${t.note ? `<span class="tx-note">${escapeHtml(t.note)}</span>` : ''}
          </div>
          <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fm(Math.abs(t.amount))}</span>
        </div>`;
    });
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="report">
  <div class="header">
    <h1>小璐记账 · 月报</h1>
    <div class="app-name">小璐记账</div>
    <div class="period">${year} 年 ${month + 1} 月 · 共 ${transactionCount || 0} 笔记录</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">收入</div>
      <div class="value" style="color:#2E9E6B">${fm(totalIncome)}</div>
      <div class="sub">${symbol}${Math.round(totalIncome / (daysInMonth || 1))}/天</div>
    </div>
    <div class="summary-card">
      <div class="label">支出</div>
      <div class="value" style="color:#333A45">${fm(totalExpense)}</div>
      <div class="sub">${symbol}${Math.round(totalExpense / (daysInMonth || 1))}/天</div>
    </div>
    <div class="summary-card">
      <div class="label">结余</div>
      <div class="value" style="color:${balance >= 0 ? '#2E9E6B' : '#E5675F'}">${fm(balance)}</div>
      <div class="sub">${balance >= 0 ? '盈余' : '超支'}</div>
    </div>
  </div>

  ${expenseCats.length > 0 ? `
  <div class="section">
    <div class="section-title">支出分类</div>
    <table class="cat-table">
      <tr><th>分类</th><th>金额</th></tr>
      ${expenseCats.map(([cat, amt]) => `
        <tr class="cat-row">
          <td>${catDot(cat, catColors)}${escapeHtml(cat)}</td>
          <td>${fm(amt)}</td>
        </tr>`).join('')}
      <tr><td class="cat-total">合计</td><td class="cat-total" style="color:#E5675F">${fm(totalExpense)}</td></tr>
    </table>
  </div>` : ''}

  ${incomeCats.length > 0 ? `
  <div class="section">
    <div class="section-title">收入分类</div>
    <table class="cat-table">
      <tr><th>分类</th><th>金额</th></tr>
      ${incomeCats.map(([cat, amt]) => `
        <tr class="cat-row">
          <td>${catDot(cat, catColors)}${escapeHtml(cat)}</td>
          <td style="color:#2E9E6B">${fm(amt)}</td>
        </tr>`).join('')}
      <tr><td class="cat-total">合计</td><td class="cat-total" style="color:#2E9E6B">${fm(totalIncome)}</td></tr>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">每日趋势</div>
    <div class="daily-chart">
      ${dailyRows}
    </div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#7C8593">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#E5675F;margin-right:4px"></span>支出</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#2E9E6B;margin-right:4px"></span>收入</span>
    </div>
  </div>

  ${txRows ? `
  <div class="section">
    <div class="section-title">交易明细（最近 20 笔）</div>
    <div class="transaction-list">${txRows}</div>
  </div>` : ''}

  <div class="footer">
    <p>由 小璐记账 自动生成</p>
    <p>${now.toLocaleDateString('zh-CN')}</p>
  </div>
</div>
</body></html>`;
}

export function generateYearlyReportHtml({
  year,
  totalIncome,
  totalExpense,
  balance,
  monthlyData,
  transactionCount,
  catColors,
  settings,
}) {
  const now = new Date();
  const fm = (v) => formatMoney(v, (settings && settings.currency) || 'CNY');

  // Monthly breakdown
  let monthlyRows = '';
  monthlyData.forEach((m, i) => {
    monthlyRows += `
      <div class="daily-row">
        <span class="day-label">${i + 1}月</span>
        <div class="bar-wrap">
          <div class="bar-expense" style="width:${m.totalExpense > 0 ? (m.totalExpense / totalExpense) * 100 : 0}%"></div>
          <div class="bar-income" style="width:${m.totalIncome > 0 ? (m.totalIncome / totalIncome) * 100 : 0}%"></div>
        </div>
        <span style="font-size:11px;color:#6B7280;min-width:60px;text-align:right;font-variant:tabular-nums">${fm(m.balance)}</span>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="report">
  <div class="header">
    <h1>小璐记账 · 年报</h1>
    <div class="app-name">小璐记账</div>
    <div class="period">${year} 年度 · 共 ${transactionCount || 0} 笔记录</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">年度收入</div>
      <div class="value" style="color:#2E9E6B">${fm(totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="label">年度支出</div>
      <div class="value" style="color:#333A45">${fm(totalExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="label">年度结余</div>
      <div class="value" style="color:${balance >= 0 ? '#2E9E6B' : '#E5675F'}">${fm(balance)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">月度趋势</div>
    <div class="daily-chart">${monthlyRows}</div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#7C8593">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#E5675F;margin-right:4px"></span>支出</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#2E9E6B;margin-right:4px"></span>收入</span>
    </div>
  </div>

  <div class="footer">
    <p>由 小璐记账 自动生成</p>
    <p>${now.toLocaleDateString('zh-CN')}</p>
  </div>
</div>
</body></html>`;
}

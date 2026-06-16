// Generate a beautifully styled HTML report for PDF export.
// Used by shareReport.js to create a monthly or yearly financial summary.

import { formatMoney } from './currency';

const REPORT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #FAFAFB;
  color: #0F172A;
  padding: 40px 32px;
}
.report { max-width: 640px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 32px; }
.header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: #0F172A; }
.header .app-name { font-size: 13px; color: #64748B; margin-top: 4px; }
.header .period { font-size: 14px; color: #64748B; margin-top: 2px; }

.summary-grid {
  display: flex; gap: 12px; margin-bottom: 28px;
}
.summary-card {
  flex: 1; background: #FFFFFF; border-radius: 16px;
  padding: 20px 16px; text-align: center;
  border: 1px solid #E5E7EB;
}
.summary-card .label { font-size: 12px; color: #64748B; font-weight: 500; margin-bottom: 6px; }
.summary-card .value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
.summary-card .sub { font-size: 11px; color: #94A3B8; margin-top: 4px; }

.section { margin-bottom: 28px; }
.section-title {
  font-size: 15px; font-weight: 600; color: #0F172A;
  margin-bottom: 12px; letter-spacing: -0.3px;
}

.cat-table { width: 100%; border-collapse: collapse; }
.cat-table th {
  text-align: left; font-size: 11px; font-weight: 600; color: #64748B;
  text-transform: uppercase; letter-spacing: 0.5px;
  padding-bottom: 8px; border-bottom: 1px solid #E5E7EB;
}
.cat-table th:last-child { text-align: right; }
.cat-table td {
  padding: 8px 0; font-size: 14px; border-bottom: 1px solid #F1F5F9;
}
.cat-table td:last-child { text-align: right; font-weight: 600; font-variant: tabular-nums; }
.cat-row .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 8px; }
.cat-total { font-weight: 700 !important; font-size: 15px !important; border-bottom: none !important; padding-top: 10px !important; }

.daily-chart { margin-top: 8px; }
.daily-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.daily-row .day-label { width: 24px; font-size: 11px; color: #94A3B8; font-weight: 500; text-align: right; }
.daily-row .bar-wrap { flex: 1; height: 14px; background: #F4F4F5; border-radius: 4px; overflow: hidden; display: flex; }
.daily-row .bar-expense { height: 100%; background: #DC2626; border-radius: 4px; opacity: 0.75; }
.daily-row .bar-income { height: 100%; background: #059669; border-radius: 4px; opacity: 0.75; }
.daily-row .bar-empty { flex: 1; }

.transaction-list { margin-top: 8px; }
.tx-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid #F1F5F9; font-size: 13px;
}
.tx-item .tx-left { display: flex; align-items: center; gap: 8px; }
.tx-item .tx-dot { width: 6px; height: 6px; border-radius: 3px; }
.tx-item .tx-cat { font-weight: 500; }
.tx-item .tx-note { color: #94A3B8; font-size: 11px; margin-left: 4px; }
.tx-item .tx-amount { font-weight: 600; font-variant: tabular-nums; }
.income { color: #059669; }
.expense { color: #0F172A; }

.footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB; }
.footer p { font-size: 11px; color: #94A3B8; }
`;

function catColor(name, catColors) {
  return catColors[name] || '#64748B';
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
      <div class="value" style="color:#059669">${fm(totalIncome)}</div>
      <div class="sub">${symbol}${Math.round(totalIncome / (daysInMonth || 1))}/天</div>
    </div>
    <div class="summary-card">
      <div class="label">支出</div>
      <div class="value" style="color:#0F172A">${fm(totalExpense)}</div>
      <div class="sub">${symbol}${Math.round(totalExpense / (daysInMonth || 1))}/天</div>
    </div>
    <div class="summary-card">
      <div class="label">结余</div>
      <div class="value" style="color:${balance >= 0 ? '#059669' : '#DC2626'}">${fm(balance)}</div>
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
      <tr><td class="cat-total">合计</td><td class="cat-total" style="color:#DC2626">${fm(totalExpense)}</td></tr>
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
          <td style="color:#059669">${fm(amt)}</td>
        </tr>`).join('')}
      <tr><td class="cat-total">合计</td><td class="cat-total" style="color:#059669">${fm(totalIncome)}</td></tr>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">每日趋势</div>
    <div class="daily-chart">
      ${dailyRows}
    </div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#94A3B8">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#DC2626;margin-right:4px"></span>支出</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#059669;margin-right:4px"></span>收入</span>
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
        <span style="font-size:11px;color:#64748B;min-width:60px;text-align:right;font-variant:tabular-nums">${fm(m.balance)}</span>
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
      <div class="value" style="color:#059669">${fm(totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="label">年度支出</div>
      <div class="value" style="color:#0F172A">${fm(totalExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="label">年度结余</div>
      <div class="value" style="color:${balance >= 0 ? '#059669' : '#DC2626'}">${fm(balance)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">月度趋势</div>
    <div class="daily-chart">${monthlyRows}</div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:#94A3B8">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#DC2626;margin-right:4px"></span>支出</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#059669;margin-right:4px"></span>收入</span>
    </div>
  </div>

  <div class="footer">
    <p>由 小璐记账 自动生成</p>
    <p>${now.toLocaleDateString('zh-CN')}</p>
  </div>
</div>
</body></html>`;
}

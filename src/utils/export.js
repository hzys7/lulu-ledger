// 数据导出工具 - 支持CSV和JSON导出
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCurrencySymbol } from './currency';

// ============ CSV 导出 ============

export async function exportTransactionsToCSV(transactions, currencyCode = 'CNY') {
  const symbol = getCurrencySymbol(currencyCode);
  const header = '日期,类型,分类,金额,货币,账本,备注\n';
  
  const rows = transactions.map(t => {
    const date = new Date(t.date).toLocaleDateString('zh-CN');
    const type = t.type === 'income' ? '收入' : '支出';
    const amount = t.type === 'income' ? t.amount : -t.amount;
    const note = (t.note || '').replace(/,/g, '，').replace(/\n/g, ' ');
    return `${date},${type},${t.category},${symbol}${Math.abs(amount).toFixed(2)},${t.currency || currencyCode},${t.bookName || ''},${note}`;
  }).join('\n');

  // 添加BOM以便Excel正确识别UTF-8编码
  const csvContent = '\uFEFF' + header + rows;
  
  const fileName = `记账记录_${formatDateForFile(new Date())}.csv`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return shareFile(fileUri);
}

// ============ JSON 导出（完整备份）============

export async function exportToJSON(data) {
  const jsonContent = JSON.stringify(data, null, 2);
  const fileName = `记账备份_${formatDateForFile(new Date())}.json`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  
  await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return shareFile(fileUri);
}

// ============ 报表数据生成 ============

export function generateMonthlySummary(transactions, year, month) {
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = {};
  const incomeByCategory = {};
  const dailyExpense = {};
  const dailyIncome = {};

  monthTx.forEach(t => {
    const day = new Date(t.date).getDate();
    if (t.type === 'expense') {
      totalExpense += t.amount;
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
      dailyExpense[day] = (dailyExpense[day] || 0) + t.amount;
    } else {
      totalIncome += t.amount;
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      dailyIncome[day] = (dailyIncome[day] || 0) + t.amount;
    }
  });

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    expenseByCategory,
    incomeByCategory,
    dailyExpense,
    dailyIncome,
    transactionCount: monthTx.length,
  };
}

export function generateYearlySummary(transactions, year) {
  const yearTx = transactions.filter(t => {
    return new Date(t.date).getFullYear() === year;
  });

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    return generateMonthlySummary(yearTx, year, i);
  });

  let totalIncome = 0;
  let totalExpense = 0;
  monthlyData.forEach(m => {
    totalIncome += m.totalIncome;
    totalExpense += m.totalExpense;
  });

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    monthlyData,
    transactionCount: yearTx.length,
  };
}

// ============ 辅助方法 ============

// ============ CSV 解析 / 导入 ============
// 支持两种格式：
//   1) 本 APP 导出格式：日期,类型,分类,金额,货币,账本,备注
//   2) 通用格式：自动识别常见列名（日期/Date/时间，类型/收支，分类/类别/Category，金额/Amount，备注/Note）
// 中文表头兼容：表头里出现"日"、"类"、"金"、"备"等关键字也能识别。

// 解析一行 CSV，正确处理双引号包裹、逗号转义、换行
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuote = false; }
      } else { cur += ch; }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuote = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// 把单元格内容解析成 ISO 字符串
// 支持格式: 2024-01-15, 2024/01/15, 2024.01.15, 2024年01月15日, 1月15日, 15/01/2024, 2024-01-15 12:30
function parseDateCell(raw) {
  if (!raw) return new Date().toISOString();
  let s = String(raw).trim();
  if (!s) return new Date().toISOString();
  // 提取开头的日期部分（空格前）
  const spaceIdx = s.search(/\s/);
  if (spaceIdx > 0) s = s.substring(0, spaceIdx);
  // 提取日期：保留数字和分隔符
  const dateMatch = s.match(/^(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})[日]?/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = dateMatch[2].padStart(2, '0');
    const d = dateMatch[3].padStart(2, '0');
    const dt = new Date(y + '-' + m + '-' + d + 'T00:00:00.000Z');
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  // 中文短日期 "1月15日" -> 当前年
  const shortMatch = s.match(/^(\d{1,2})[月.-](\d{1,2})[日]?/);
  if (shortMatch) {
    const y = new Date().getFullYear();
    const m = shortMatch[1].padStart(2, '0');
    const d = shortMatch[2].padStart(2, '0');
    const dt = new Date(y + '-' + m + '-' + d + 'T00:00:00.000Z');
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  // dd/MM/yyyy 或 dd-MM-yyyy
  const dmyMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const y = dmyMatch[3];
    const m = dmyMatch[2].padStart(2, '0');
    const d = dmyMatch[1].padStart(2, '0');
    const dt = new Date(y + '-' + m + '-' + d + 'T00:00:00.000Z');
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  // fallback: 尝试原生解析
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString();
  return new Date().toISOString();
}

// 把单元格解析成数字（带货币符号、千分位、负号）
function parseAmountCell(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim();
  // 去掉货币符号和空格
  s = s.replace(/[¥$€£￥]/g, '').replace(/,/g, '').replace(/\s+/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

// 从表头找出每列的含义，返回 { date, type, category, amount, note, currency, book }
function detectColumns(headerCells) {
  const find = (keywords) => {
    for (let i = 0; i < headerCells.length; i++) {
      const h = String(headerCells[i] || '').toLowerCase();
      for (const k of keywords) {
        if (h === k.toLowerCase() || h.includes(k.toLowerCase())) return i;
      }
    }
    return -1;
  };
  return {
    date: find(['日期', 'date', 'time', '时间', '交易日期', '记账日期']),
    type: find(['类型', '收支', 'type', 'category_type', 'in_out']),
    category: find(['分类', '类别', 'category', '类目']),
    amount: find(['金额', 'amount', 'money', 'value', '数额']),
    note: find(['备注', 'note', 'memo', 'description', '说明']),
    currency: find(['货币', 'currency']),
    book: find(['账本', 'book', '账户', 'account']),
  };
}

// 判断 type 字段是收入还是支出
function detectType(raw) {
  if (!raw) return 'expense';
  const s = String(raw).trim();
  // 中文: 收入/支出, 收/支
  if (/收|入/i.test(s) && !/支/.test(s)) return 'income';
  if (/支|出/i.test(s)) return 'expense';
  // 英文: income/expense
  if (/income|revenue|in\b/i.test(s)) return 'income';
  if (/expense|out|spend/i.test(s)) return 'expense';
  // 数字 1/0
  if (s === '1') return 'income';
  if (s === '0' || s === '-1') return 'expense';
  // 正负金额：正数视为收入，负数视为支出（部分 APP 用正负区分）
  const n = parseFloat(s);
  if (!isNaN(n)) return n >= 0 ? 'income' : 'expense';
  return 'expense';
}

function genTxId() {
  return 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

// 把 CSV 文本解析成 transactions 数组
// mode:
//   'auto'  - 自动识别本 APP 格式或通用格式（推荐）
//   'native' - 只识别本 APP 自己的导出格式
export function parseCSVToTransactions(csvText, mode = 'auto') {
  if (!csvText || typeof csvText !== 'string') return [];
  // 去 BOM
  let text = csvText.replace(/^\uFEFF/, '');
  // 去掉空行
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerCells = parseCSVLine(lines[0]).map((c) => c.trim());
  const cols = detectColumns(headerCells);

  // 至少要能识别日期和金额
  if (cols.date === -1 || cols.amount === -1) {
    // 尝试按"位置"猜测：本 APP 格式是 [日期,类型,分类,金额,货币,账本,备注]
    if (mode === 'auto' && headerCells.length >= 4) {
      return parseNativeCSV(lines, headerCells);
    }
    return [];
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const rawAmount = cells[cols.amount] || '';
    const amountNum = parseAmountCell(rawAmount);
    if (!amountNum) continue;
    const type = cols.type >= 0 ? detectType(cells[cols.type]) : 'expense';
    out.push({
      id: genTxId(),
      type,
      amount: amountNum,
      category: cols.category >= 0 ? (cells[cols.category] || '其他') : '其他',
      note: cols.note >= 0 ? (cells[cols.note] || '') : '',
      date: parseDateCell(cells[cols.date]),
      currency: cols.currency >= 0 ? (cells[cols.currency] || 'CNY') : 'CNY',
      bookId: 'default',
      bookName: cols.book >= 0 ? (cells[cols.book] || '') : '',
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

// 本 APP 自己的导出格式：[日期,类型,分类,金额,货币,账本,备注]
function parseNativeCSV(lines, headerCells) {
  const out = [];
  // 找表头各列位置（按本 APP 默认顺序）
  const idx = {
    date: headerCells.findIndex((h) => h.includes('日期')),
    type: headerCells.findIndex((h) => h.includes('类型')),
    category: headerCells.findIndex((h) => h.includes('分类')),
    amount: headerCells.findIndex((h) => h.includes('金额')),
    currency: headerCells.findIndex((h) => h.includes('货币')),
    book: headerCells.findIndex((h) => h.includes('账本')),
    note: headerCells.findIndex((h) => h.includes('备注')),
  };
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const rawAmount = idx.amount >= 0 ? cells[idx.amount] : '';
    // 本 APP 格式: 收入为正、支出为负
    const amountStr = String(rawAmount || '').replace(/[¥$€£￥]/g, '').replace(/,/g, '').trim();
    const amountNum = Math.abs(parseFloat(amountStr));
    if (!amountNum) continue;
    const typeRaw = idx.type >= 0 ? cells[idx.type] : '';
    // 本 APP 导出的 type 是"收入"或"支出"
    let type = detectType(typeRaw);
    // 如果 amount 带负号（支出场景），强制 expense
    if (amountStr.startsWith('-')) type = 'expense';
    out.push({
      id: genTxId(),
      type,
      amount: amountNum,
      category: idx.category >= 0 ? (cells[idx.category] || '其他') : '其他',
      note: idx.note >= 0 ? (cells[idx.note] || '') : '',
      date: parseDateCell(cells[idx.date]),
      currency: idx.currency >= 0 ? (cells[idx.currency] || 'CNY') : 'CNY',
      bookId: 'default',
      bookName: idx.book >= 0 ? (cells[idx.book] || '') : '',
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

// 智能导入：自动判断是 JSON 还是 CSV
export function parseImportText(text) {
  if (!text || typeof text !== 'string') {
    return { format: 'unknown', transactions: [], fullData: null };
  }
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { format: 'unknown', transactions: [], fullData: null };

  // JSON: 必须以 { 或 [ 开头
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    try {
      const data = JSON.parse(trimmed);
      // 本 APP 完整备份
      if (data && typeof data === 'object' && (data.transactions || data.books || data.budgets || data.accounts || data.settings)) {
        return { format: 'json', transactions: data.transactions || [], fullData: data };
      }
      // 纯 transactions 数组
      if (Array.isArray(data)) {
        return { format: 'json', transactions: data, fullData: null };
      }
      // 单个 transaction 对象
      if (data && data.amount && (data.type === 'income' || data.type === 'expense')) {
        return { format: 'json', transactions: [data], fullData: null };
      }
      // 不是已知格式
      return { format: 'json', transactions: [], fullData: data };
    } catch (e) {
      // JSON 解析失败，可能实际是 CSV
      const tx = parseCSVToTransactions(trimmed, 'auto');
      if (tx.length > 0) return { format: 'csv', transactions: tx, fullData: null };
      throw new Error('无法解析为 JSON 或 CSV');
    }
  }

  // CSV
  const tx = parseCSVToTransactions(trimmed, 'auto');
  if (tx.length === 0) {
    throw new Error('CSV 解析失败：缺少日期或金额列');
  }
  return { format: 'csv', transactions: tx, fullData: null };
}

function formatDateForFile(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function shareFile(uri) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri);
    return true;
  }
  return uri; // 返回路径供后续处理
}

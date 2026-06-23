// 数据导出工具 - 支持CSV和JSON导出
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getCurrencySymbol } from './currency';
import { parseCSVToTransactions as _parseCSV } from './csvParser';

// ============ CSV 导出 ============

export async function exportTransactionsToCSV(transactions, currencyCode = 'CNY', accounts = []) {
  const symbol = getCurrencySymbol(currencyCode);
  const acctMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));
  const header = '日期,类型,分类,金额,货币,账户,账本,备注\n';
  
  const rows = transactions.map(t => {
    const date = new Date(t.date).toLocaleDateString('zh-CN');
    const type = t.type === 'income' ? '收入' : '支出';
    const amount = t.type === 'income' ? t.amount : -t.amount;
    const note = (t.note || '').replace(/,/g, '，').replace(/\n/g, ' ');
    const acctName = (t.accountId && acctMap[t.accountId]) || '';
    return `${date},${type},${t.category},${symbol}${Math.abs(amount).toFixed(2)},${t.currency || currencyCode},${acctName},${t.bookName || ''},${note}`;
  }).join('\n');

  // 添加BOM以便Excel正确识别UTF-8编码
  const csvContent = '\uFEFF' + header + rows;
  
  const fileName = `记账记录_${formatDateForFile(new Date())}.csv`;
  const file = new File(Paths.document, fileName);

  await file.write(csvContent);

  return shareFile(file);
}

// ============ JSON 导出（完整备份）============

export async function exportToJSON(data) {
  const jsonContent = JSON.stringify(data, null, 2);
  const fileName = `记账备份_${formatDateForFile(new Date())}.json`;
  const file = new File(Paths.document, fileName);

  await file.write(jsonContent);

  return shareFile(file);
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
// 所有 CSV 解析函数集中在 csvParser.js 中，此处仅引用
// (parseCSVLine, parseDateCell, parseAmountCell, detectColumns, detectType, genTxId, parseNativeCSV)

export const parseCSVToTransactions = (csvText, mode = 'auto') => _parseCSV(csvText, mode);

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

async function shareFile(file) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(file.uri, {
      mimeType: file.name.endsWith('.json') ? 'application/json' : 'text/csv',
    });
    return true;
  }
  return file.uri; // 返回路径供后续处理
}

// 弹原生文件选择器，选择 CSV/JSON 文件，返回文本内容
// 用户取消选择时返回 null
export async function pickImportFile() {
  try {
    const result = await File.pickFileAsync({
      mimeTypes: ['text/csv', 'text/comma-separated-values', 'application/json', 'application/octet-stream', '*/*'],
    });
    
    // 新 API 返回 { result: File, canceled: boolean }
    if (result.canceled || !result.result) return null;
    
    const file = result.result;
    const text = await file.text();
    
    // 从 URI 中提取文件名
    const uriParts = file.uri.split('/');
    const name = uriParts[uriParts.length - 1] || 'backup.json';
    
    return { name, text };
  } catch (e) {
    // 取消选择不抛错
    if (e && /cancel/i.test(String(e.message || e))) return null;
    throw e;
  }
}

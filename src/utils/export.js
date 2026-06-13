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

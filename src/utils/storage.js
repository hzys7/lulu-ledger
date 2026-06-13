// 数据存储层 - 兼容 Web 和 Native 的本地持久化
import { Platform } from 'react-native';

// Web 端使用 localStorage，Native 端使用 AsyncStorage
let AsyncStorage;
if (Platform.OS === 'web') {
  AsyncStorage = {
    getItem: async (key) => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    setItem: async (key, value) => {
      try { window.localStorage.setItem(key, value); } catch {}
    },
    removeItem: async (key) => {
      try { window.localStorage.removeItem(key); } catch {}
    },
  };
} else {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

const STORAGE_KEYS = {
  TRANSACTIONS: '@colorful_ledger_transactions',
  BOOKS: '@colorful_ledger_books',
  BUDGETS: '@colorful_ledger_budgets',
  SETTINGS: '@colorful_ledger_settings',
  CURRENT_BOOK: '@colorful_ledger_current_book',
  RECURRING: '@colorful_ledger_recurring',
  ACCOUNTS: '@colorful_ledger_accounts',
};

// ============ 通用方法 ============

async function getData(key) {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Storage read error:', e);
    return null;
  }
}

async function setData(key, value) {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return true;
  } catch (e) {
    console.error('Storage write error:', e);
    return false;
  }
}

async function removeData(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('Storage remove error:', e);
    return false;
  }
}

// ============ 交易记录 ============

export async function getTransactions(bookId) {
  const all = await getData(STORAGE_KEYS.TRANSACTIONS);
  if (!all) return [];
  if (bookId) {
    return all.filter(t => t.bookId === bookId);
  }
  return all;
}

export async function addTransaction(transaction) {
  const all = (await getData(STORAGE_KEYS.TRANSACTIONS)) || [];
  all.unshift(transaction);
  await setData(STORAGE_KEYS.TRANSACTIONS, all);
  return all;
}

export async function updateTransaction(id, updates) {
  const all = (await getData(STORAGE_KEYS.TRANSACTIONS)) || [];
  const index = all.findIndex(t => t.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    await setData(STORAGE_KEYS.TRANSACTIONS, all);
  }
  return all;
}

export async function deleteTransaction(id) {
  const all = (await getData(STORAGE_KEYS.TRANSACTIONS)) || [];
  const filtered = all.filter(t => t.id !== id);
  await setData(STORAGE_KEYS.TRANSACTIONS, filtered);
  return filtered;
}

// ============ 账本 ============

export async function getBooks() {
  const books = await getData(STORAGE_KEYS.BOOKS);
  if (!books || books.length === 0) {
    // 创建默认账本
    const defaultBooks = [
      {
        id: 'default',
        name: '日常账本',
        icon: 'wallet',
        color: '#6C63FF',
        currency: 'CNY',
        createdAt: new Date().toISOString(),
      },
    ];
    await setData(STORAGE_KEYS.BOOKS, defaultBooks);
    return defaultBooks;
  }
  return books;
}

export async function addBook(book) {
  const all = await getBooks();
  all.push(book);
  await setData(STORAGE_KEYS.BOOKS, all);
  return all;
}

export async function updateBook(id, updates) {
  const all = await getBooks();
  const index = all.findIndex(b => b.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    await setData(STORAGE_KEYS.BOOKS, all);
  }
  return all;
}

export async function deleteBook(id) {
  const all = await getBooks();
  const filtered = all.filter(b => b.id !== id);
  await setData(STORAGE_KEYS.BOOKS, filtered);
  // 同时删除该账本下的所有交易
  const transactions = (await getData(STORAGE_KEYS.TRANSACTIONS)) || [];
  const filteredTx = transactions.filter(t => t.bookId !== id);
  await setData(STORAGE_KEYS.TRANSACTIONS, filteredTx);
  return filtered;
}

export async function getCurrentBookId() {
  const id = await getData(STORAGE_KEYS.CURRENT_BOOK);
  return id || 'default';
}

export async function setCurrentBookId(id) {
  await setData(STORAGE_KEYS.CURRENT_BOOK, id);
}

// ============ 预算 ============

export async function getBudgets(bookId) {
  const all = await getData(STORAGE_KEYS.BUDGETS);
  if (!all) return [];
  if (bookId) {
    return all.filter(b => b.bookId === bookId);
  }
  return all;
}

export async function setBudget(budget) {
  const all = (await getData(STORAGE_KEYS.BUDGETS)) || [];
  const index = all.findIndex(
    b => b.bookId === budget.bookId && b.category === budget.category && b.month === budget.month
  );
  if (index !== -1) {
    all[index] = { ...all[index], ...budget };
  } else {
    all.push(budget);
  }
  await setData(STORAGE_KEYS.BUDGETS, all);
  return all;
}

export async function deleteBudget(bookId, category, month) {
  const all = (await getData(STORAGE_KEYS.BUDGETS)) || [];
  const filtered = all.filter(
    b => !(b.bookId === bookId && b.category === category && b.month === month)
  );
  await setData(STORAGE_KEYS.BUDGETS, filtered);
  return filtered;
}

// ============ 账户（净资产）============

export async function getAccounts(bookId) {
  const all = await getData(STORAGE_KEYS.ACCOUNTS);
  if (!all) return [];
  if (bookId) return all.filter(a => a.bookId === bookId);
  return all;
}

export async function addAccount(account) {
  const all = (await getData(STORAGE_KEYS.ACCOUNTS)) || [];
  // 默认账户唯一性：当前账本下已存在默认账户时，新增的不能是默认
  if (account.isDefault) {
    all.forEach(a => { if (a.bookId === account.bookId) a.isDefault = false; });
  }
  all.push(account);
  await setData(STORAGE_KEYS.ACCOUNTS, all);
  return all;
}

export async function updateAccount(id, updates) {
  const all = (await getData(STORAGE_KEYS.ACCOUNTS)) || [];
  const index = all.findIndex(a => a.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    if (updates.isDefault) {
      // 取消同账本下其他默认
      const bookId = all[index].bookId;
      all.forEach((a, i) => { if (i !== index && a.bookId === bookId) a.isDefault = false; });
    }
    await setData(STORAGE_KEYS.ACCOUNTS, all);
  }
  return all;
}

export async function deleteAccount(id) {
  const all = (await getData(STORAGE_KEYS.ACCOUNTS)) || [];
  const filtered = all.filter(a => a.id !== id);
  await setData(STORAGE_KEYS.ACCOUNTS, filtered);
  return filtered;
}

export async function adjustAccountBalance(id, delta) {
  // delta > 0 增加；< 0 减少。调账用
  const all = (await getData(STORAGE_KEYS.ACCOUNTS)) || [];
  const index = all.findIndex(a => a.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], balance: (Number(all[index].balance) || 0) + delta };
    await setData(STORAGE_KEYS.ACCOUNTS, all);
  }
  return all;
}

// ============ 设置 ============

export async function getSettings() {
  const settings = await getData(STORAGE_KEYS.SETTINGS);
  return settings || {
    currency: 'CNY',
    firstDayOfWeek: 1, // 1=周一
    theme: 'light',
    notifications: true,
  };
}

export async function updateSettings(updates) {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await setData(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// ============ 数据批量操作 ============

export async function exportAllData() {
  const [transactions, books, budgets, settings, accounts] = await Promise.all([
    getData(STORAGE_KEYS.TRANSACTIONS),
    getData(STORAGE_KEYS.BOOKS),
    getData(STORAGE_KEYS.BUDGETS),
    getData(STORAGE_KEYS.SETTINGS),
    getData(STORAGE_KEYS.ACCOUNTS),
  ]);
  return {
    transactions: transactions || [],
    books: books || [],
    budgets: budgets || [],
    settings: settings || {},
    accounts: accounts || [],
    exportDate: new Date().toISOString(),
    version: '1.0.0',
  };
}

// 智能导入：支持 JSON 完整备份 / 纯 transactions 数组 / CSV 文本
// mode: 'merge' (默认，追加并去重) | 'replace' (覆盖)
// 返回 { format, added, skipped, total }
export async function importData(data, mode = 'merge') {
  if (!data || typeof data !== 'object') {
    throw new Error('导入数据为空');
  }

  // 完整备份导入（来自 exportAllData）
  const hasFullBackup = data.transactions || data.books || data.budgets || data.settings || data.accounts;

  if (hasFullBackup) {
    if (Array.isArray(data.transactions)) {
      const stats = await mergeTransactions(data.transactions);
      if (mode === 'replace') {
        await setData(STORAGE_KEYS.TRANSACTIONS, data.transactions);
      }
    }
    if (mode === 'replace') {
      if (data.books) await setData(STORAGE_KEYS.BOOKS, data.books);
      if (data.budgets) await setData(STORAGE_KEYS.BUDGETS, data.budgets);
      if (data.settings) await setData(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.accounts) await setData(STORAGE_KEYS.ACCOUNTS, data.accounts);
    }
    return { format: 'json', ...(stats || { added: 0, skipped: 0, total: 0 }) };
  }

  // 纯 transactions 数组
  if (Array.isArray(data)) {
    const stats = await mergeTransactions(data);
    if (mode === 'replace') {
      await setData(STORAGE_KEYS.TRANSACTIONS, data);
    }
    return { format: 'json', ...stats };
  }

  throw new Error('无法识别的导入格式');
}

// 合并 transactions：去重（按 id 或 内容指纹），保留已有
async function mergeTransactions(newOnes) {
  const existing = (await getData(STORAGE_KEYS.TRANSACTIONS)) || [];
  const seen = new Set();
  for (const t of existing) {
    seen.add(makeTxFingerprint(t));
  }
  const toAdd = [];
  let skipped = 0;
  for (const t of newOnes) {
    if (!t || typeof t !== 'object') { skipped++; continue; }
    const fp = makeTxFingerprint(t);
    if (seen.has(fp)) { skipped++; continue; }
    seen.add(fp);
    toAdd.push(t);
  }
  const merged = toAdd.concat(existing); // 新的在前面
  await setData(STORAGE_KEYS.TRANSACTIONS, merged);
  return { added: toAdd.length, skipped, total: merged.length };
}

// 交易指纹：用于去重（id 优先，否则 date+amount+category+note+type）
function makeTxFingerprint(t) {
  if (t && t.id) return 'id:' + t.id;
  const d = (t && t.date) || '';
  const a = (t && t.amount) || 0;
  const c = (t && t.category) || '';
  const n = (t && t.note) || '';
  const ty = (t && t.type) || '';
  return 'fp:' + ty + '|' + d + '|' + a + '|' + c + '|' + n;
}

// 从 CSV 文本导入 transactions（用通用解析器，支持本 APP 格式 + 其他 APP 的 CSV）
// 返回 { added, skipped, total }
export async function importTransactionsFromCSV(csvText, bookId) {
  const { parseCSVToTransactions } = require('./export');
  const txs = parseCSVToTransactions(csvText, 'auto').map((t) => ({
    ...t,
    bookId: bookId || t.bookId || 'default',
  }));
  return await mergeTransactions(txs);
}

export async function clearAllData() {
  await Promise.all(
    Object.values(STORAGE_KEYS).map(key => removeData(key))
  );
  return true;
}

// ============ 周期性交易 ============

export async function getRecurring() {
  return (await getData(STORAGE_KEYS.RECURRING)) || [];
}

export async function addRecurring(item) {
  const all = await getRecurring();
  all.push(item);
  await setData(STORAGE_KEYS.RECURRING, all);
  return all;
}

export async function deleteRecurring(id) {
  const all = await getRecurring();
  const filtered = all.filter(r => r.id !== id);
  await setData(STORAGE_KEYS.RECURRING, filtered);
  return filtered;
}

export async function processRecurring(currentBookId) {
  const all = await getRecurring();
  if (all.length === 0) return [];

  const now = new Date();
  const toProcess = [];
  const remaining = [];

  all.forEach(item => {
    const lastDate = item.lastProcessedDate ? new Date(item.lastProcessedDate) : null;
    let shouldProcess = false;

    if (!lastDate) {
      shouldProcess = true;
    } else {
      switch (item.frequency) {
        case 'daily':
          shouldProcess = (now - lastDate) >= 86400000;
          break;
        case 'weekly':
          shouldProcess = (now - lastDate) >= 604800000;
          break;
        case 'monthly':
          shouldProcess = now.getMonth() !== lastDate.getMonth() || now.getFullYear() !== lastDate.getFullYear();
          break;
        case 'yearly':
          shouldProcess = now.getFullYear() !== lastDate.getFullYear();
          break;
      }
    }

    if (shouldProcess) {
      toProcess.push({ ...item, lastProcessedDate: now.toISOString() });
      remaining.push({ ...item, lastProcessedDate: now.toISOString() });
    } else {
      remaining.push(item);
    }
  });

  if (toProcess.length > 0) {
    await setData(STORAGE_KEYS.RECURRING, remaining);
  }

  return toProcess;
}

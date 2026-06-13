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

export async function importData(data) {
  if (data.transactions) await setData(STORAGE_KEYS.TRANSACTIONS, data.transactions);
  if (data.books) await setData(STORAGE_KEYS.BOOKS, data.books);
  if (data.budgets) await setData(STORAGE_KEYS.BUDGETS, data.budgets);
  if (data.settings) await setData(STORAGE_KEYS.SETTINGS, data.settings);
  if (data.accounts) await setData(STORAGE_KEYS.ACCOUNTS, data.accounts);
  return true;
}

export async function importTransactionsFromCSV(csvText, bookId) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const all = (await getData(STORAGE_KEYS.TRANSACTIONS)) || [];
  const newTransactions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 4) continue;
    const tx = {
      id: `tx_import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bookId: bookId || 'default',
      bookName: '',
      type: values[0] || 'expense',
      category: values[1] || '其他',
      amount: parseFloat(values[2]) || 0,
      date: values[3] || new Date().toISOString(),
      note: values[4] || '',
      currency: values[5] || 'CNY',
      createdAt: new Date().toISOString(),
    };
    if (tx.amount > 0) newTransactions.push(tx);
  }
  all.push(...newTransactions);
  await setData(STORAGE_KEYS.TRANSACTIONS, all);
  return newTransactions;
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

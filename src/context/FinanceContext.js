// 全局状态管理 - 统一管理账本、交易、预算
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import * as storage from '../utils/storage';


// 数据清洗：旧版本/脏数据可能导致 undefined.amount 等崩溃
function sanitizeTransactions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      id: t.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      type: t.type === 'income' ? 'income' : 'expense',
      amount: Number(t.amount) > 0 ? Number(t.amount) : 0,
      category: t.category || '其他支出',
      note: t.note || '',
      date: t.date || new Date().toISOString(),
      currency: t.currency || 'CNY',
      bookId: t.bookId || 'default',
      bookName: t.bookName || '',
      createdAt: t.createdAt || new Date().toISOString(),
    }))
    .filter((t) => t.amount > 0);
}

function sanitizeBooks(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return [{
      id: 'default',
      name: '日常账本',
      icon: 'wallet',
      color: '#6C63FF',
      currency: 'CNY',
      createdAt: new Date().toISOString(),
    }];
  }
  return list
    .filter((b) => b && b.id)
    .map((b) => ({
      id: b.id,
      name: b.name || '未命名账本',
      icon: b.icon || 'wallet',
      color: b.color || '#6C63FF',
      currency: b.currency || 'CNY',
      createdAt: b.createdAt || new Date().toISOString(),
    }));
}

function sanitizeBudgets(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      ...b,
      amount: Number(b.amount) > 0 ? Number(b.amount) : 0,
      month: b.month || '' ,
      category: b.category || '其他支出',
      bookId: b.bookId || 'default',
    }))
    .filter((b) => b.amount > 0 && b.month);
}

function sanitizeAccounts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      id: a.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      bookId: a.bookId || 'default',
      name: a.name || '账户',
      type: ['wechat','alipay','bank','cash','other'].includes(a.type) ? a.type : 'other',
      balance: Number(a.balance) || 0,
      color: a.color || '#6C63FF',
      icon: a.icon || 'wallet',
      isDefault: !!a.isDefault,
      createdAt: a.createdAt || new Date().toISOString(),
    }));
}

function sanitizeRecurring(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && r.id && r.type && Number(r.amount) > 0);
}

const DEFAULT_SETTINGS = {
  currency: 'CNY',
  firstDayOfWeek: 1,
  theme: 'light',
  notifications: true,
};
const FinanceContext = createContext();

export function FinanceProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [books, setBooks] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [currentBookId, setCurrentBookId] = useState('default');
  const [recurring, setRecurring] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [settings, setSettings] = useState({
    currency: 'CNY',
    firstDayOfWeek: 1,
    theme: 'light',
    notifications: true,
  });
  const [loading, setLoading] = useState(true);

  // ============ 初始化加载 ============
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [booksData, currentBook, settingsData] = await Promise.all([
        storage.getBooks(),
        storage.getCurrentBookId(),
        storage.getSettings(),
      ]);
      setBooks(sanitizeBooks(booksData));
      setCurrentBookId(currentBook);
      setSettings({ ...DEFAULT_SETTINGS, ...(settingsData || {}) });

      const txData = await storage.getTransactions(currentBook);
      setTransactions(sanitizeTransactions(txData));

      const budgetData = await storage.getBudgets(currentBook);
      setBudgets(sanitizeBudgets(budgetData));

      const recurringData = await storage.getRecurring();
      setRecurring(sanitizeRecurring(recurringData));

      const accountsData = await storage.getAccounts(currentBook);
      setAccounts(sanitizeAccounts(accountsData));

      const dueItems = await storage.processRecurring(currentBook);
      if (dueItems.length > 0) {
        for (const item of dueItems) {
          const tx = {
            type: item.type,
            amount: item.amount,
            category: item.category,
            note: item.note || `[周期] ${item.frequency}`,
            date: new Date().toISOString(),
            currency: item.currency || settingsData.currency,
            bookId: currentBook,
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
          };
          await storage.addTransaction(tx);
        }
        const updatedTx = await storage.getTransactions(currentBook);
        setTransactions(updatedTx);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setLoading(false);
  }

  // ============ 账本操作 ============
  const switchBook = useCallback(async (bookId) => {
    setCurrentBookId(bookId);
    await storage.setCurrentBookId(bookId);
    const txData = await storage.getTransactions(bookId);
    setTransactions(txData);
    const budgetData = await storage.getBudgets(bookId);
    setBudgets(budgetData);
    const accountsData = await storage.getAccounts(bookId);
    setAccounts(sanitizeAccounts(accountsData));
  }, []);

  const createBook = useCallback(async (book) => {
    const updated = await storage.addBook(book);
    setBooks(updated);
    return updated;
  }, []);

  const editBook = useCallback(async (id, updates) => {
    const updated = await storage.updateBook(id, updates);
    setBooks(updated);
    return updated;
  }, []);

  const removeBook = useCallback(async (id) => {
    const updated = await storage.deleteBook(id);
    setBooks(updated);
    if (currentBookId === id && updated.length > 0) {
      await switchBook(updated[0].id);
    }
    return updated;
  }, [currentBookId, switchBook]);

  // ============ 交易操作 ============
  const addTx = useCallback(async (transaction) => {
    const tx = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bookId: currentBookId,
      bookName: books.find(b => b.id === currentBookId)?.name || '',
      currency: transaction.currency || settings.currency,
      createdAt: new Date().toISOString(),
    };
    // 联动账户余额：支出扣减，收入增加；无 accountId 时回退到默认账户
    const targetAccountId = tx.accountId || (accounts.find(a => a.isDefault && a.bookId === currentBookId)?.id) || null;
    if (targetAccountId) {
      const delta = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
      const updatedAccounts = await storage.adjustAccountBalance(targetAccountId, delta);
      setAccounts(sanitizeAccounts(updatedAccounts.filter(a => a.bookId === currentBookId)));
      tx.accountId = targetAccountId;
    }
    const updated = await storage.addTransaction(tx);
    const filtered = updated.filter(t => t.bookId === currentBookId);
    setTransactions(filtered);
    return tx;
  }, [currentBookId, books, settings.currency, accounts]);

  const editTx = useCallback(async (id, updates) => {
    const old = transactions.find(t => t.id === id);
    const updated = await storage.updateTransaction(id, updates);
    const filtered = updated.filter(t => t.bookId === currentBookId);
    setTransactions(filtered);
    if (old) {
      // 撤销旧值
      const oldAccountId = old.accountId || (accounts.find(a => a.isDefault && a.bookId === currentBookId)?.id);
      const oldDelta = old.type === 'income' ? -Number(old.amount) : Number(old.amount);
      let allAccounts = accounts;
      if (oldAccountId) {
        const r = await storage.adjustAccountBalance(oldAccountId, oldDelta);
        allAccounts = sanitizeAccounts(r.filter(a => a.bookId === currentBookId));
      }
      // 应用新值
      const newType = updates.type || old.type;
      const newAmount = updates.amount !== undefined ? Number(updates.amount) : Number(old.amount);
      const newAccountId = updates.accountId || old.accountId || (allAccounts.find(a => a.isDefault)?.id);
      const newDelta = newType === 'income' ? newAmount : -newAmount;
      if (newAccountId) {
        const r2 = await storage.adjustAccountBalance(newAccountId, newDelta);
        allAccounts = sanitizeAccounts(r2.filter(a => a.bookId === currentBookId));
      }
      setAccounts(allAccounts);
    }
  }, [currentBookId, transactions, accounts]);

  const removeTx = useCallback(async (id) => {
    const old = transactions.find(t => t.id === id);
    const updated = await storage.deleteTransaction(id);
    const filtered = updated.filter(t => t.bookId === currentBookId);
    setTransactions(filtered);
    if (old) {
      const accId = old.accountId || (accounts.find(a => a.isDefault && a.bookId === currentBookId)?.id);
      if (accId) {
        const delta = old.type === 'income' ? -Number(old.amount) : Number(old.amount);
        const r = await storage.adjustAccountBalance(accId, delta);
        setAccounts(sanitizeAccounts(r.filter(a => a.bookId === currentBookId)));
      }
    }
  }, [currentBookId, transactions, accounts]);

  // ============ 账户（净资产）操作 ============
  const addAccount = useCallback(async (account) => {
    const acc = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      bookId: currentBookId,
      createdAt: new Date().toISOString(),
    };
    const updated = await storage.addAccount(acc);
    setAccounts(sanitizeAccounts(updated.filter(a => a.bookId === currentBookId)));
    return acc;
  }, [currentBookId]);

  const editAccount = useCallback(async (id, updates) => {
    const updated = await storage.updateAccount(id, updates);
    setAccounts(sanitizeAccounts(updated.filter(a => a.bookId === currentBookId)));
  }, [currentBookId]);

  const removeAccount = useCallback(async (id) => {
    const updated = await storage.deleteAccount(id);
    setAccounts(sanitizeAccounts(updated.filter(a => a.bookId === currentBookId)));
  }, [currentBookId]);

  // 手动调账：直接修正账户余额（例如发现微信实际多了/少了钱）
  const adjustAccount = useCallback(async (id, delta) => {
    const updated = await storage.adjustAccountBalance(id, delta);
    setAccounts(sanitizeAccounts(updated.filter(a => a.bookId === currentBookId)));
  }, [currentBookId]);

  const setDefaultAccount = useCallback(async (id) => {
    const updated = await storage.updateAccount(id, { isDefault: true });
    setAccounts(sanitizeAccounts(updated.filter(a => a.bookId === currentBookId)));
  }, [currentBookId]);

  const getNetWorth = useCallback(() => {
    return accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  // ============ 预算操作 ============
  const updateBudget = useCallback(async (budget) => {
    const b = { ...budget, bookId: currentBookId };
    const updated = await storage.setBudget(b);
    const filtered = updated.filter(b => b.bookId === currentBookId);
    setBudgets(filtered);
    return filtered;
  }, [currentBookId]);

  const removeBudget = useCallback(async (category, month) => {
    const updated = await storage.deleteBudget(currentBookId, category, month);
    const filtered = updated.filter(b => b.bookId === currentBookId);
    setBudgets(filtered);
    return filtered;
  }, [currentBookId]);

  // ============ 周期性交易操作 ============
  const addRecurringItem = useCallback(async (item) => {
    const updated = await storage.addRecurring({ ...item, id: `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` });
    setRecurring(updated);
    return updated;
  }, []);

  const removeRecurringItem = useCallback(async (id) => {
    const updated = await storage.deleteRecurring(id);
    setRecurring(updated);
    return updated;
  }, []);

  // ============ 预算超支提醒 ============
  const checkBudgetAlerts = useCallback(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && t.type === 'expense';
    });

    const byCategory = {};
    monthTx.forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });

    const alerts = [];
    budgets.filter(b => b.month === currentMonth).forEach(b => {
      const spent = byCategory[b.category] || 0;
      if (spent > b.amount) {
        alerts.push({
          category: b.category,
          budget: b.amount,
          spent,
          over: spent - b.amount,
        });
      }
    });
    return alerts;
  }, [transactions, budgets]);

  // ============ 搜索操作 ============
  const searchTransactions = useCallback((query, filters = {}) => {
    let result = transactions;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q))
      );
    }
    if (filters.type) {
      result = result.filter(t => t.type === filters.type);
    }
    if (filters.startDate) {
      result = result.filter(t => new Date(t.date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      result = result.filter(t => new Date(t.date) <= new Date(filters.endDate));
    }
    if (filters.minAmount !== undefined) {
      result = result.filter(t => t.amount >= filters.minAmount);
    }
    if (filters.maxAmount !== undefined) {
      result = result.filter(t => t.amount <= filters.maxAmount);
    }
    return result;
  }, [transactions]);

  // ============ 设置操作 ============
  const updateAppSettings = useCallback(async (updates) => {
    const updated = await storage.updateSettings(updates);
    setSettings(updated);
    return updated;
  }, []);

  // ============ 计算属性 ============
  const currentBook = books.find(b => b.id === currentBookId) || books[0];

  const getMonthTransactions = useCallback((year, month) => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [transactions]);

  const getMonthSummary = useCallback((year, month) => {
    const monthTx = getMonthTransactions(year, month);
    let income = 0, expense = 0;
    const expenseByCategory = {};
    const incomeByCategory = {};

    monthTx.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      } else {
        expense += t.amount;
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
      }
    });

    return {
      income,
      expense,
      balance: income - expense,
      byCategory: expenseByCategory,
      incomeByCategory,
      transactionCount: monthTx.length,
    };
  }, [getMonthTransactions]);

  const value = useMemo(() => ({
    // 状态
    transactions,
    books,
    budgets,
    recurring,
    accounts,
    currentBookId,
    currentBook,
    settings,
    loading,
    // 账本操作
    switchBook,
    createBook,
    editBook,
    removeBook,
    // 交易操作
    addTx,
    editTx,
    removeTx,
    getMonthTransactions,
    getMonthSummary,
    // 账户（净资产）操作
    addAccount,
    editAccount,
    removeAccount,
    adjustAccount,
    setDefaultAccount,
    getNetWorth,
    // 预算操作
    updateBudget,
    removeBudget,
    checkBudgetAlerts,
    // 周期性交易操作
    addRecurringItem,
    removeRecurringItem,
    // 设置操作
    updateAppSettings,
    // 重新加载
    reload: loadData,
  }), [
    transactions, books, budgets, recurring, accounts, currentBookId, currentBook, settings, loading,
    switchBook, createBook, editBook, removeBook,
    addTx, editTx, removeTx, getMonthTransactions, getMonthSummary,
    addAccount, editAccount, removeAccount, adjustAccount, setDefaultAccount, getNetWorth,
    updateBudget, removeBudget, checkBudgetAlerts,
    addRecurringItem, removeRecurringItem,
    updateAppSettings, loadData,
  ]);

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within FinanceProvider');
  }
  return context;
}

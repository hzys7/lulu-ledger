// DataContext: transactions, budgets, accounts, recurring + their CRUD.
// This is the only context that re-renders on data writes. It still avoids
// the previous behaviour where ANY field change re-rendered EVERY consumer:
// the value only changes when one of [transactions, budgets, accounts,
// recurring, loaded] or one of the CRUD callbacks changes.
import React, { createContext, useState, useContext, useCallback, useMemo, useRef, useEffect } from 'react';
import * as storage from '../utils/storage';
import {
  sanitizeTransactions,
  sanitizeBudgets,
  sanitizeAccounts,
  sanitizeRecurring,
} from './sanitizers';
import { useBooks } from './BooksContext';
import { useSettings } from './SettingsContext';
import UndoToast from '../components/UndoToast';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { currentBookId, books, switchBook } = useBooks();
  const { settings } = useSettings();

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // --------------- undo delete ---------------
  const [undoInfo, setUndoInfo] = useState(null);
  const undoTimeoutRef = useRef(null);
  const undoDataRef = useRef(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const initFromStorage = useCallback(async () => {
    if (!currentBookId) return;
    const [txData, budgetData, recurringData, accountsData, dueItems] = await Promise.all([
      storage.getTransactions(currentBookId),
      storage.getBudgets(currentBookId),
      storage.getRecurring(),
      storage.getAccounts(currentBookId),
      storage.processRecurring(currentBookId),
    ]);
    setTransactions(sanitizeTransactions(txData));
    setBudgets(sanitizeBudgets(budgetData));
    setRecurring(sanitizeRecurring(recurringData));
    setAccounts(sanitizeAccounts(accountsData));

    if (Array.isArray(dueItems) && dueItems.length > 0) {
      for (const item of dueItems) {
        const tx = {
          type: item.type,
          amount: item.amount,
          category: item.category,
          note: item.note || `[周期] ${item.frequency}`,
          date: new Date().toISOString(),
          currency: item.currency || settings.currency,
          bookId: currentBookId,
          bookName: books.find(b => b.id === currentBookId)?.name || '',
          createdAt: new Date().toISOString(),
        };
        await storage.addTransaction(tx);
      }
      const refreshed = await storage.getTransactions(currentBookId);
      setTransactions(sanitizeTransactions(refreshed));
    }
    setLoaded(true);
  }, [currentBookId, books, settings.currency]);

  // --------------- transactions ---------------

  const addTx = useCallback(async (transaction) => {
    const tx = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bookId: currentBookId,
      bookName: books.find(b => b.id === currentBookId)?.name || '',
      currency: transaction.currency || settings.currency,
      createdAt: new Date().toISOString(),
    };
    const targetAccountId = tx.accountId
      || (accounts.find(a => a.isDefault && a.bookId === currentBookId)?.id)
      || null;
    if (targetAccountId) {
      const delta = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
      const updatedAccounts = await storage.adjustAccountBalance(targetAccountId, delta);
      setAccounts(sanitizeAccounts(updatedAccounts.filter(a => a.bookId === currentBookId)));
      tx.accountId = targetAccountId;
    }
    const updated = await storage.addTransaction(tx);
    setTransactions(sanitizeTransactions(updated.filter(t => t.bookId === currentBookId)));
    return tx;
  }, [currentBookId, books, settings.currency, accounts]);

  const editTx = useCallback(async (id, updates) => {
    const old = transactions.find(t => t.id === id);
    const updated = await storage.updateTransaction(id, updates);
    setTransactions(sanitizeTransactions(updated.filter(t => t.bookId === currentBookId)));
    if (old) {
      const oldAccountId = old.accountId
        || (accounts.find(a => a.isDefault && a.bookId === currentBookId)?.id);
      const oldDelta = old.type === 'income' ? -Number(old.amount) : Number(old.amount);
      let allAccounts = accounts;
      if (oldAccountId) {
        const r = await storage.adjustAccountBalance(oldAccountId, oldDelta);
        allAccounts = sanitizeAccounts(r.filter(a => a.bookId === currentBookId));
      }
      const newType = updates.type || old.type;
      const newAmount = updates.amount !== undefined ? Number(updates.amount) : Number(old.amount);
      const newAccountId = updates.accountId
        || old.accountId
        || (allAccounts.find(a => a.isDefault)?.id);
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
    setTransactions(sanitizeTransactions(updated.filter(t => t.bookId === currentBookId)));
    let accId = null;
    let accDelta = 0;
    if (old) {
      accId = old.accountId
        || (accounts.find(a => a.isDefault && a.bookId === currentBookId)?.id);
      if (accId) {
        accDelta = old.type === 'income' ? -Number(old.amount) : Number(old.amount);
        const r = await storage.adjustAccountBalance(accId, accDelta);
        setAccounts(sanitizeAccounts(r.filter(a => a.bookId === currentBookId)));
      }
    }
    // Show undo toast for 5 seconds
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoDataRef.current = old ? { deletedTx: old, accId, accDelta } : null;
    setUndoInfo(old ? { deletedTx: old, accId, accDelta } : { deletedTx: null });
    undoTimeoutRef.current = setTimeout(() => {
      undoDataRef.current = null;
      setUndoInfo(null);
      undoTimeoutRef.current = null;
    }, 5000);
  }, [currentBookId, transactions, accounts]);

  const undoDelete = useCallback(async () => {
    const info = undoDataRef.current;
    if (!info || !info.deletedTx) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    // Re-add the transaction (preserves original id)
    await storage.addTransaction(info.deletedTx);
    const refreshed = await storage.getTransactions(currentBookId);
    setTransactions(sanitizeTransactions(refreshed.filter(t => t.bookId === currentBookId)));
    // Reverse the account balance reversal (re-apply original effect)
    if (info.accId) {
      const r = await storage.adjustAccountBalance(info.accId, -info.accDelta);
      setAccounts(sanitizeAccounts(r.filter(a => a.bookId === currentBookId)));
    }
    undoDataRef.current = null;
    setUndoInfo(null);
  }, [currentBookId]);

  const clearUndo = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    undoDataRef.current = null;
    setUndoInfo(null);
  }, []);

  // --------------- accounts ---------------

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

  // --------------- budgets ---------------

  const updateBudget = useCallback(async (budget) => {
    const b = { ...budget, bookId: currentBookId };
    const updated = await storage.setBudget(b);
    setBudgets(sanitizeBudgets(updated.filter(b => b.bookId === currentBookId)));
  }, [currentBookId]);

  const removeBudget = useCallback(async (category, month) => {
    const updated = await storage.deleteBudget(currentBookId, category, month);
    setBudgets(sanitizeBudgets(updated.filter(b => b.bookId === currentBookId)));
  }, [currentBookId]);

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

  // --------------- recurring ---------------

  const addRecurringItem = useCallback(async (item) => {
    const updated = await storage.addRecurring({
      ...item,
      id: `rc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
    setRecurring(sanitizeRecurring(updated));
  }, []);

  const removeRecurringItem = useCallback(async (id) => {
    const updated = await storage.deleteRecurring(id);
    setRecurring(sanitizeRecurring(updated));
  }, []);

  // --------------- derived ---------------

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

  const reload = useCallback(() => initFromStorage(), [initFromStorage]);

  // Re-load data when the active book changes.
  React.useEffect(() => {
    if (!currentBookId) return;
    setLoaded(false);
    initFromStorage();
  }, [currentBookId, initFromStorage]);

  const value = useMemo(() => ({
    transactions,
    budgets,
    accounts,
    recurring,
    loaded,
    addTx,
    editTx,
    removeTx,
    addAccount,
    editAccount,
    removeAccount,
    adjustAccount,
    setDefaultAccount,
    getNetWorth,
    updateBudget,
    removeBudget,
    checkBudgetAlerts,
    addRecurringItem,
    removeRecurringItem,
    getMonthTransactions,
    getMonthSummary,
    reload,
  }), [
    transactions, budgets, accounts, recurring, loaded,
    addTx, editTx, removeTx,
    addAccount, editAccount, removeAccount, adjustAccount, setDefaultAccount, getNetWorth,
    updateBudget, removeBudget, checkBudgetAlerts,
    addRecurringItem, removeRecurringItem,
    getMonthTransactions, getMonthSummary,
    reload,
  ]);

  return (
    <>
      <DataContext.Provider value={value}>{children}</DataContext.Provider>
      <UndoToast
        visible={undoInfo !== null && undoInfo.deletedTx !== null}
        message="已删除 1 笔交易"
        onUndo={undoDelete}
        onTimeout={clearUndo}
      />
    </>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

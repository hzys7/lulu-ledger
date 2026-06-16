// 顶层 Provider 嵌套：Settings -> Books -> Data。
// 公开 FinanceProvider 和 useFinance() -- 与旧 API 完全一致。
//
// 拆分原因（旧版 1.2.33 之前）：
//   - 旧 FinanceContext 一个 provider 暴露 25+ 字段+方法，任何字段变
//     都让 useMemo value 重新计算，所有 consumer 都 re-render。
//   - 拆分后：只读 settings 的组件（Button, PieRing, ...）只在 settings
//     变时 re-render；只读 books 的组件只在 books 变时 re-render。
//
// 1.2.34 起的 Provider 层次：
//   FinanceProvider
//     -> SettingsProvider  (settings / updateAppSettings)
//        -> BooksProvider  (books / currentBookId / currentBook / book CRUD)
//           -> DataProvider (transactions / budgets / accounts / recurring / CRUD / derived)
//
// 内部 useFinance() 是个聚合 hook：按字段名路由到对应 context，所以旧代码
// `const { transactions, settings, addTx } = useFinance();` 一行不用改。
import React, { useMemo, useEffect } from 'react';
import { useSettings, SettingsProvider } from './SettingsContext';
import { useBooks, BooksProvider } from './BooksContext';
import { useData, DataProvider } from './DataContext';

export function FinanceProvider({ children }) {
  return (
    <SettingsProvider>
      <BooksProvider>
        <DataProvider>{children}</DataProvider>
      </BooksProvider>
    </SettingsProvider>
  );
}

// One-time bootstrap that loads all three providers in order. Settings is
// independent, Books depends on its own storage, Data depends on both.
// We expose a top-level `loaded` flag the app can use to gate rendering.
export function useFinanceBoot() {
  const settings = useSettings();
  const books = useBooks();
  const data = useData();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Settings and Books can be loaded in parallel; Data waits for the
      // book id to be known.
      await Promise.all([
        settings.initFromStorage(),
        books.initFromStorage(),
      ]);
      if (!cancelled) await data.initFromStorage();
    })();
    return () => { cancelled = true; };
  }, []); // run once

  return settings.loaded && books.loaded && data.loaded;
}

export function useFinance() {
  const settings = useSettings();
  const books = useBooks();
  const data = useData();
  return useMemo(() => ({
    // state
    settings: settings.settings,
    loading: !(settings.loaded && books.loaded && data.loaded),
    books: books.books,
    currentBookId: books.currentBookId,
    currentBook: books.currentBook,
    transactions: data.transactions,
    budgets: data.budgets,
    accounts: data.accounts,
    recurring: data.recurring,
    // settings ops
    updateAppSettings: settings.updateAppSettings,
    // book ops
    switchBook: books.switchBook,
    createBook: books.createBook,
    editBook: books.editBook,
    removeBook: books.removeBook,
    // tx ops
    addTx: data.addTx,
    editTx: data.editTx,
    removeTx: data.removeTx,
    getMonthTransactions: data.getMonthTransactions,
    getMonthSummary: data.getMonthSummary,
    // account ops
    addAccount: data.addAccount,
    editAccount: data.editAccount,
    removeAccount: data.removeAccount,
    adjustAccount: data.adjustAccount,
    setDefaultAccount: data.setDefaultAccount,
    getNetWorth: data.getNetWorth,
    // budget ops
    updateBudget: data.updateBudget,
    removeBudget: data.removeBudget,
    checkBudgetAlerts: data.checkBudgetAlerts,
    // recurring ops
    addRecurringItem: data.addRecurringItem,
    removeRecurringItem: data.removeRecurringItem,
    // misc
    reload: data.reload,
  }), [
    settings.settings, settings.loaded, settings.updateAppSettings,
    books.books, books.currentBookId, books.currentBook, books.loaded,
    books.switchBook, books.createBook, books.editBook, books.removeBook,
    data.transactions, data.budgets, data.accounts, data.recurring, data.loaded,
    data.addTx, data.editTx, data.removeTx, data.getMonthTransactions, data.getMonthSummary,
    data.addAccount, data.editAccount, data.removeAccount, data.adjustAccount,
    data.setDefaultAccount, data.getNetWorth,
    data.updateBudget, data.removeBudget, data.checkBudgetAlerts,
    data.addRecurringItem, data.removeRecurringItem,
    data.reload,
  ]);
}

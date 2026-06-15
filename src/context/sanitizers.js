// Data sanitizers: clean legacy/dirty records before they enter app state.
// Each function takes a value that came from AsyncStorage (or a user-edited
// object) and returns a clean, well-typed record.

export function sanitizeTransactions(list) {
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

export function sanitizeBooks(list) {
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

export function sanitizeBudgets(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      ...b,
      amount: Number(b.amount) > 0 ? Number(b.amount) : 0,
      month: b.month || '',
      category: b.category || '其他支出',
      bookId: b.bookId || 'default',
    }))
    .filter((b) => b.amount > 0 && b.month);
}

export function sanitizeAccounts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      id: a.id || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      bookId: a.bookId || 'default',
      name: a.name || '账户',
      type: ['wechat', 'alipay', 'bank', 'cash', 'other'].includes(a.type) ? a.type : 'other',
      balance: Number(a.balance) || 0,
      color: a.color || '#6C63FF',
      icon: a.icon || 'wallet',
      isDefault: !!a.isDefault,
      createdAt: a.createdAt || new Date().toISOString(),
    }));
}

export function sanitizeRecurring(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && r.id && r.type && Number(r.amount) > 0);
}

export const DEFAULT_SETTINGS = {
  currency: 'CNY',
  firstDayOfWeek: 1,
  theme: 'light',
  notifications: true,
  useProxy: false,
  autoCheckUpdate: true,
};

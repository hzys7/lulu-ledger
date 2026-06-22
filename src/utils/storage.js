// 数据存储层 - 兼容 Web 和 Native 的本地持久化
import { Platform } from 'react-native';
import { toNumber } from './safeNumber';

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

// =============================================================================
// Schema versioning
// =============================================================================
// 1.2.34+ writes ALL app data into a single key (STORAGE_KEYS.SCHEMA) as a
// JSON envelope { version, data }. Older releases stored each list under its
// own key (STORAGE_KEYS.TRANSACTIONS / BOOKS / ...). On first launch with the
// new code, we detect the old keys, copy them verbatim into
// STORAGE_KEYS.LEGACY_BACKUP (so we can always roll back), and migrate
// them into the new envelope under version 1.
// Any future change to the shape of `data` should bump SCHEMA_VERSION and
// add a migration step in runMigrations().
export const SCHEMA_VERSION = 1;
const LEGACY_MIGRATION_FLAG = '@@lulu_migrated_legacy_v0';

const STORAGE_KEYS = {
  SCHEMA: '@lulu_ledger_schema',
  LEGACY_BACKUP: '@lulu_ledger_legacy_v0_backup',
  // Legacy keys (kept readable for the migration step; no new code should
  // touch them).
  LEGACY_TRANSACTIONS: '@colorful_ledger_transactions',
  LEGACY_BOOKS: '@colorful_ledger_books',
  LEGACY_BUDGETS: '@colorful_ledger_budgets',
  LEGACY_SETTINGS: '@colorful_ledger_settings',
  LEGACY_CURRENT_BOOK: '@colorful_ledger_current_book',
  LEGACY_RECURRING: '@colorful_ledger_recurring',
  LEGACY_ACCOUNTS: '@colorful_ledger_accounts',
};

// Default shape for `data` in the v1 envelope. Anything that reads from the
// envelope can rely on every field existing.
const EMPTY_DATA = {
  transactions: [],
  books: [],
  budgets: [],
  settings: null,
  currentBookId: 'default',
  recurring: [],
  accounts: [],
};

// In-memory cache of the envelope. We re-read from AsyncStorage when the
// cache is null; once loaded, every read/write hits the cache so we avoid
// a JSON.parse on every getter call.
let cache = null;

// Simple mutex for write serialisation. Because all write operations go
// through ensureLoaded() + direct cache mutation + persist(), two concurrent
// async flows can both call ensureLoaded(), get the same cache reference,
// mutate it, then persist() in sequence — the second persist() will overwrite
// the first mutation. The mutex queues persist() calls so they never interleave
// with a read-then-write from another async flow.
let _writeLock = Promise.resolve();

async function withLock(fn) {
  // Wait for the previous lock holder to finish, then acquire.
  // Using promise chaining (not await / release pattern) to avoid
  // the "unhandled promise" footgun if fn throws.
  let release;
  const next = new Promise((resolve) => { release = resolve; });
  const prev = _writeLock;
  _writeLock = next;
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// --------------- low-level helpers ---------------

async function rawGet(key) {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Storage read error:', e);
    return null;
  }
}

async function rawSet(key, value, _retries = 1) {
  for (let attempt = 0; attempt <= _retries; attempt++) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (attempt < _retries) {
        // Brief backoff before retrying (250 ms) -- in case of a transient
        // storage contention or low-memory pressure.
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      console.error('Storage write error:', e);
      return false;
    }
  }
  return false;
}

async function rawRemove(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('Storage remove error:', e);
    return false;
  }
}

// --------------- migration ---------------

// v0 -> v1: copy every legacy key into the new envelope. We back up the
// original keys first so the migration is non-destructive.
async function migrateV0ToV1() {
  const already = await rawGet(LEGACY_MIGRATION_FLAG);
  if (already) return; // idempotent

  const [tx, books, budgets, settings, currentBook, recurring, accounts] = await Promise.all([
    rawGet(STORAGE_KEYS.LEGACY_TRANSACTIONS),
    rawGet(STORAGE_KEYS.LEGACY_BOOKS),
    rawGet(STORAGE_KEYS.LEGACY_BUDGETS),
    rawGet(STORAGE_KEYS.LEGACY_SETTINGS),
    rawGet(STORAGE_KEYS.LEGACY_CURRENT_BOOK),
    rawGet(STORAGE_KEYS.LEGACY_RECURRING),
    rawGet(STORAGE_KEYS.LEGACY_ACCOUNTS),
  ]);

  const hasAnyLegacy =
    tx !== null || books !== null || budgets !== null ||
    settings !== null || currentBook !== null || recurring !== null ||
    accounts !== null;

  if (!hasAnyLegacy) {
    // First install under the new schema, nothing to migrate.
    await rawSet(LEGACY_MIGRATION_FLAG, { at: new Date().toISOString(), migrated: false });
    return;
  }

  // Back up each legacy key verbatim so the user can roll back if needed.
  const backup = {
    transactions: tx,
    books,
    budgets,
    settings,
    currentBookId: currentBook,
    recurring,
    accounts,
    backedUpAt: new Date().toISOString(),
  };
  await rawSet(STORAGE_KEYS.LEGACY_BACKUP, backup);

  // Compose the new envelope.
  const data = {
    ...EMPTY_DATA,
    transactions: Array.isArray(tx) ? tx : [],
    books: Array.isArray(books) ? books : [],
    budgets: Array.isArray(budgets) ? budgets : [],
    settings: settings && typeof settings === 'object' ? settings : null,
    currentBookId: typeof currentBook === 'string' ? currentBook : 'default',
    recurring: Array.isArray(recurring) ? recurring : [],
    accounts: Array.isArray(accounts) ? accounts : [],
  };

  await rawSet(STORAGE_KEYS.SCHEMA, { version: SCHEMA_VERSION, data });
  await rawSet(LEGACY_MIGRATION_FLAG, { at: new Date().toISOString(), migrated: true });
}

// Append-only migration runner. Each step takes a parsed envelope, mutates
// it in place, and returns the (possibly bumped) version. This is a no-op
// for v0 -> v1 because that work happens in migrateV0ToV1 above.
function runMigrations(envelope) {
  let v = envelope.version || 0;
  const data = envelope.data;
  // Example for a future bump:
  //   if (v === 1) { v = 2; ...transform data... }
  return { version: v, data };
}

async function loadEnvelope() {
  // First: pull a fresh copy of the schema key.
  const stored = await rawGet(STORAGE_KEYS.SCHEMA);

  if (stored && typeof stored === 'object' && typeof stored.version === 'number') {
    // Apply any in-envelope migrations (cheap in-memory).
    return runMigrations(stored);
  }

  // No envelope yet: try the v0 -> v1 path.
  await migrateV0ToV1();
  const after = await rawGet(STORAGE_KEYS.SCHEMA);
  if (after && typeof after === 'object' && typeof after.version === 'number') {
    return after;
  }
  // Brand-new install: seed an empty envelope.
  const seeded = { version: SCHEMA_VERSION, data: { ...EMPTY_DATA } };
  await rawSet(STORAGE_KEYS.SCHEMA, seeded);
  return seeded;
}

async function ensureLoaded() {
  if (cache !== null) return cache;
  cache = await loadEnvelope();
  return cache;
}

async function persist() {
  if (cache === null) return false;
  return await withLock(() => rawSet(STORAGE_KEYS.SCHEMA, cache));
}

// Reset the in-memory cache (useful for tests or after clearAllData).
export function _resetStorageCache() {
  cache = null;
}

// Read a single field out of the envelope. Returns a deep copy so callers
// cannot accidentally mutate the in-memory cache.
async function readField(field) {
  const env = await ensureLoaded();
  const val = env.data[field];
  // JSON round-trip for a safe deep copy (fast enough for our data sizes).
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

// Replace a single field in the envelope and persist.
async function writeField(field, value) {
  const env = await ensureLoaded();
  env.data[field] = value;
  return await persist();
}

// =============================================================================
// Public API: every old call site still compiles against the same names. We
// either return cached envelope fields or call AsyncStorage once and splice
// the result back into the envelope so subsequent reads are fast.
// =============================================================================

// --------------- transactions ---------------

export async function getTransactions(bookId) {
  const all = (await readField('transactions')) || [];
  if (bookId) return all.filter(t => t && t.bookId === bookId);
  return all;
}

export async function addTransaction(transaction) {
  // Direct cache mutation: eliminates readField (deep copy) + writeField
  // (another deep copy + persist). Now: ensureLoaded → unshift → persist once.
  const env = await ensureLoaded();
  const all = env.data.transactions || [];
  all.unshift(transaction);
  await persist();
  return all;
}

export async function updateTransaction(id, updates) {
  const env = await ensureLoaded();
  const all = env.data.transactions || [];
  const index = all.findIndex(t => t && t.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    await persist();
  }
  return all;
}

export async function deleteTransaction(id) {
  const env = await ensureLoaded();
  const all = env.data.transactions || [];
  const filtered = all.filter(t => t && t.id !== id);
  env.data.transactions = filtered;
  await persist();
  return filtered;
}

// --------------- books ---------------

export async function getBooks() {
  const books = (await readField('books')) || [];
  if (books.length === 0) {
    const defaults = [{
      id: 'default',
      name: '日常账本',
      icon: 'wallet',
      color: '#6C63FF',
      currency: 'CNY',
      createdAt: new Date().toISOString(),
    }];
    await writeField('books', defaults);
    return defaults;
  }
  return books;
}

export async function addBook(book) {
  // Direct cache mutation — getBooks() returns a deep copy via readField
  // so we must use ensureLoaded() to reach the live cache.
  const env = await ensureLoaded();
  const all = env.data.books || [];
  all.push(book);
  await persist();
  return all;
}

export async function updateBook(id, updates) {
  const env = await ensureLoaded();
  const all = env.data.books || [];
  const index = all.findIndex(b => b && b.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    await persist();
  }
  return all;
}

export async function deleteBook(id) {
  // Single persist: both books and transactions updates in one pass
  const env = await ensureLoaded();
  env.data.books = (env.data.books || []).filter(b => b && b.id !== id);
  env.data.transactions = (env.data.transactions || []).filter(t => t && t.bookId !== id);
  await persist();
  return env.data.books;
}

export async function getCurrentBookId() {
  const id = await readField('currentBookId');
  return id || 'default';
}

export async function setCurrentBookId(id) {
  await writeField('currentBookId', id);
}

// --------------- budgets ---------------

export async function getBudgets(bookId) {
  const all = (await readField('budgets')) || [];
  if (bookId) return all.filter(b => b && b.bookId === bookId);
  return all;
}

export async function setBudget(budget) {
  const env = await ensureLoaded();
  const all = env.data.budgets || [];
  const index = all.findIndex(
    b => b && b.bookId === budget.bookId && b.category === budget.category && b.month === budget.month
  );
  if (index !== -1) {
    all[index] = { ...all[index], ...budget };
  } else {
    all.push(budget);
  }
  await persist();
  return all;
}

export async function deleteBudget(bookId, category, month) {
  const env = await ensureLoaded();
  const all = env.data.budgets || [];
  const filtered = all.filter(
    b => !(b && b.bookId === bookId && b.category === category && b.month === month)
  );
  env.data.budgets = filtered;
  await persist();
  return filtered;
}

// --------------- settings ---------------

export async function getSettings() {
  return (await readField('settings')) || null;
}

export async function updateSettings(updates) {
  const env = await ensureLoaded();
  const current = env.data.settings || {};
  env.data.settings = { ...current, ...updates };
  await persist();
  return env.data.settings;
}

// --------------- accounts ---------------

export async function getAccounts(bookId) {
  const all = (await readField('accounts')) || [];
  if (bookId) return all.filter(a => a && a.bookId === bookId);
  return all;
}

export async function addAccount(account) {
  const env = await ensureLoaded();
  const all = env.data.accounts || [];
  all.push(account);
  await persist();
  return all;
}

export async function updateAccount(id, updates) {
  const env = await ensureLoaded();
  const all = env.data.accounts || [];
  const index = all.findIndex(a => a && a.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...updates };
    await persist();
  }
  return all;
}

export async function deleteAccount(id) {
  const env = await ensureLoaded();
  const all = env.data.accounts || [];
  const filtered = all.filter(a => a && a.id !== id);
  env.data.accounts = filtered;
  await persist();
  return filtered;
}

// 直接加减账户余额（用于记账联动调账、手动对账）
export async function adjustAccountBalance(id, delta) {
  const env = await ensureLoaded();
  const all = env.data.accounts || [];
  const index = all.findIndex(a => a && a.id === id);
  if (index !== -1) {
    const cur = toNumber(all[index].balance);
    all[index] = { ...all[index], balance: cur + toNumber(delta) };
    await persist();
  }
  return all;
}

// --------------- batch operations (atomic) ---------------

/**
 * 批量调整多个账户余额，单次 persist，保证原子性。
 * @param {Array<{ id: string, delta: number }>} adjustments
 * @returns {Promise<Array>} 全部账户列表
 */
export async function batchAdjustAccountBalances(adjustments) {
  if (!adjustments || adjustments.length === 0) return [];
  const env = await ensureLoaded();
  const all = env.data.accounts || [];
  for (const { id, delta } of adjustments) {
    const index = all.findIndex(a => a && a.id === id);
    if (index !== -1) {
      const cur = toNumber(all[index].balance);
      all[index] = { ...all[index], balance: cur + toNumber(delta) };
    }
  }
  await persist();
  return all;
}

// --------------- import / export ---------------

export async function exportAllData() {
  const env = await ensureLoaded();
  return { ...env.data };
}

// 把导入数据合并/替换到 envelope。
// mode: 'merge' (默认，追加并去重) | 'replace' (覆盖)
export async function importData(data, mode = 'merge') {
  if (!data || typeof data !== 'object') {
    throw new Error('导入数据为空');
  }

  const hasFullBackup = data.transactions || data.books || data.budgets || data.settings || data.accounts;

  if (hasFullBackup) {
    if (mode === 'replace') {
      // 替换模式：单次 persist 保证原子性（而非逐个 writeField）
      const env = await ensureLoaded();
      if (data.transactions !== undefined) env.data.transactions = data.transactions;
      if (data.books !== undefined) env.data.books = data.books;
      if (data.budgets !== undefined) env.data.budgets = data.budgets;
      if (data.settings !== undefined) env.data.settings = data.settings;
      if (data.accounts !== undefined) env.data.accounts = data.accounts;
      if (data.recurring !== undefined) env.data.recurring = data.recurring;
      if (data.currentBookId !== undefined) env.data.currentBookId = data.currentBookId;
      await persist();
      return { format: 'json', mode: 'replace', total: (data.transactions || []).length };
    } else {
      // 合并模式：追加并去重
      let stats = { added: 0, skipped: 0, total: 0 };
      if (Array.isArray(data.transactions)) {
        stats = await mergeTransactions(data.transactions);
      }
      return { format: 'json', ...stats };
    }
  }

  if (Array.isArray(data)) {
    const stats = await mergeTransactions(data);
    return { format: 'json', ...stats };
  }

  throw new Error('无法识别的导入格式');
}

async function mergeTransactions(newOnes) {
  // Incremental write: work directly with the in-memory cache to avoid
  // two deep-copy round-trips (readField → JSON.parse, writeField →
  // JSON.stringify). Previously this read all transactions, created a
  // deep copy, processed, then wrote back — another deep copy + persist.
  // Now we read the cached array once, mutate in place, and persist once.
  const env = await ensureLoaded();
  const existing = env.data.transactions || [];
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
  // Prepend new transactions (newest first) — mutate cache directly
  env.data.transactions = toAdd.concat(existing);
  await persist();
  return { added: toAdd.length, skipped, total: env.data.transactions.length };
}

function makeTxFingerprint(t) {
  if (t && t.id) return 'id:' + t.id;
  const d = (t && t.date) || '';
  const a = (t && t.amount) || 0;
  const c = (t && t.category) || '';
  const n = (t && t.note) || '';
  const ty = (t && t.type) || '';
  return 'fp:' + ty + '|' + d + '|' + a + '|' + c + '|' + n;
}

export async function importTransactionsFromCSV(csvText, bookId) {
  const { parseCSVToTransactions } = require('./export');
  const txs = parseCSVToTransactions(csvText, 'auto').map((t) => ({
    ...t,
    bookId: bookId || t.bookId || 'default',
  }));
  return await mergeTransactions(txs);
}

export async function clearAllData() {
  await rawRemove(STORAGE_KEYS.SCHEMA);
  // also remove the legacy backup so a "clear all" really means "clear all"
  await rawRemove(STORAGE_KEYS.LEGACY_BACKUP);
  _resetStorageCache();
  return true;
}

// --------------- recurring ---------------

export async function getRecurring() {
  return (await readField('recurring')) || [];
}

export async function addRecurring(item) {
  const env = await ensureLoaded();
  const all = env.data.recurring || [];
  all.push(item);
  await persist();
  return all;
}

export async function deleteRecurring(id) {
  const env = await ensureLoaded();
  const all = env.data.recurring || [];
  env.data.recurring = all.filter(r => r && r.id !== id);
  await persist();
  return env.data.recurring;
}

export async function processRecurring(currentBookId) {
  // Must use ensureLoaded() — getRecurring() returns a deep copy.
  // Without this, the updated lastProcessedDate in `remaining` is never
  // written back to the cache and the same items get re-processed forever.
  const env = await ensureLoaded();
  const all = env.data.recurring || [];
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
    env.data.recurring = remaining;
    await persist();
  }

  return toProcess;
}

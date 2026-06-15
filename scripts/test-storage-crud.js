// Smoke test for storage.js CRUD operations (add/update/delete/merge).
//   node scripts/test-storage-crud.js
//
// Mirrors the CRUD logic of src/utils/storage.js against an in-memory fake
// (same approach as test-storage-migration.js). The production module pulls
// in react-native and AsyncStorage, neither of which is available in Node,
// so we re-derive the logic here.

const assert = require("node:assert/strict");

// ---- In-memory fake store ----
function makeStore() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : null; },
    async set(k, v) { m.set(k, JSON.parse(JSON.stringify(v))); return true; },
    async remove(k) { m.delete(k); return true; },
    _raw: m,
  };
}

// ---- Constants (mirror of src/utils/storage.js) ----
const STORAGE_KEYS = {
  SCHEMA: "@lulu_ledger_schema",
};
const SCHEMA_VERSION = 1;
const EMPTY_DATA = {
  transactions: [],
  books: [],
  budgets: [],
  settings: null,
  currentBookId: "default",
  recurring: [],
  accounts: [],
};

// ---- Cache + helpers (mirror of storage.js) ----
let cache = null;

function resetCache() { cache = null; }

async function rawGet(store, key) { return store.get(key); }
async function rawSet(store, key, value) { return store.set(key, value); }

async function persist(store) {
  if (cache === null) return false;
  return rawSet(store, STORAGE_KEYS.SCHEMA, cache);
}

async function ensureLoaded(store) {
  if (cache !== null) return cache;
  const stored = await rawGet(store, STORAGE_KEYS.SCHEMA);
  if (stored && typeof stored === "object" && typeof stored.version === "number") {
    cache = JSON.parse(JSON.stringify(stored));
    return cache;
  }
  cache = JSON.parse(JSON.stringify({ version: SCHEMA_VERSION, data: EMPTY_DATA }));
  return cache;
}

// ---- CRUD functions (mirror of storage.js) ----

async function getTransactions(store, bookId) {
  const env = await ensureLoaded(store);
  // readField returns deep copy
  const all = JSON.parse(JSON.stringify(env.data.transactions || []));
  if (bookId) return all.filter(t => t && t.bookId === bookId);
  return all;
}

async function addTransaction(store, tx) {
  const env = await ensureLoaded(store);
  const all = env.data.transactions || [];
  all.unshift(tx);
  await persist(store);
  return all;
}

async function updateTransaction(store, id, updates) {
  const env = await ensureLoaded(store);
  const all = env.data.transactions || [];
  const idx = all.findIndex(t => t && t.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates };
    await persist(store);
  }
  return all;
}

async function deleteTransaction(store, id) {
  const env = await ensureLoaded(store);
  const all = env.data.transactions || [];
  env.data.transactions = all.filter(t => t && t.id !== id);
  await persist(store);
  return env.data.transactions;
}

function makeTxFingerprint(t) {
  if (t && t.id) return "id:" + t.id;
  const d = (t && t.date) || "";
  const a = (t && t.amount) || 0;
  const c = (t && t.category) || "";
  const n = (t && t.note) || "";
  const ty = (t && t.type) || "";
  return "fp:" + ty + "|" + d + "|" + a + "|" + c + "|" + n;
}

async function mergeTransactions(store, newOnes) {
  const env = await ensureLoaded(store);
  const existing = env.data.transactions || [];
  const seen = new Set();
  for (const t of existing) seen.add(makeTxFingerprint(t));
  const toAdd = [];
  let skipped = 0;
  for (const t of newOnes) {
    if (!t || typeof t !== "object") { skipped++; continue; }
    const fp = makeTxFingerprint(t);
    if (seen.has(fp)) { skipped++; continue; }
    seen.add(fp);
    toAdd.push(t);
  }
  env.data.transactions = toAdd.concat(existing);
  await persist(store);
  return { added: toAdd.length, skipped, total: env.data.transactions.length };
}

// ---- Tests ----

async function test1_addTransaction() {
  resetCache();
  const store = makeStore();
  const tx = { id: "tx1", amount: 100, type: "expense", category: "Food" };
  const result = await addTransaction(store, tx);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "tx1");

  const readback = await getTransactions(store);
  assert.equal(readback.length, 1);
  assert.equal(readback[0].amount, 100);
  console.log("  ok  test1_addTransaction");
}

async function test2_addMultiple() {
  resetCache();
  const store = makeStore();
  await addTransaction(store, { id: "t1", amount: 10, type: "expense" });
  await addTransaction(store, { id: "t2", amount: 20, type: "income" });
  await addTransaction(store, { id: "t3", amount: 30, type: "expense" });
  const all = await getTransactions(store);
  // unshift → newest first
  assert.equal(all.length, 3);
  assert.equal(all[0].id, "t3");
  assert.equal(all[1].id, "t2");
  assert.equal(all[2].id, "t1");
  console.log("  ok  test2_addMultiple");
}

async function test3_updateTransaction() {
  resetCache();
  const store = makeStore();
  await addTransaction(store, { id: "t1", amount: 100, type: "expense", note: "" });
  await updateTransaction(store, "t1", { amount: 150, note: "updated" });
  const all = await getTransactions(store);
  assert.equal(all.length, 1);
  assert.equal(all[0].amount, 150);
  assert.equal(all[0].note, "updated");
  assert.equal(all[0].type, "expense"); // unchanged field
  console.log("  ok  test3_updateTransaction");
}

async function test4_deleteTransaction() {
  resetCache();
  const store = makeStore();
  await addTransaction(store, { id: "t1", amount: 10, type: "expense" });
  await addTransaction(store, { id: "t2", amount: 20, type: "income" });
  await deleteTransaction(store, "t1");
  const all = await getTransactions(store);
  assert.equal(all.length, 1);
  assert.equal(all[0].id, "t2");
  console.log("  ok  test4_deleteTransaction");
}

async function test5_deleteNonexistent() {
  resetCache();
  const store = makeStore();
  await addTransaction(store, { id: "t1", amount: 10, type: "expense" });
  await deleteTransaction(store, "nonexistent");
  const all = await getTransactions(store);
  assert.equal(all.length, 1);
  assert.equal(all[0].id, "t1");
  console.log("  ok  test5_deleteNonexistent");
}

async function test6_mergeTransactionsDedup() {
  resetCache();
  const store = makeStore();
  const existing = [
    { id: "t1", amount: 10, type: "expense", category: "Food", date: "2026-01-01", note: "" },
  ];
  const env = await ensureLoaded(store);
  env.data.transactions = existing;
  await persist(store);

  const incoming = [
    { id: "t1", amount: 10, type: "expense", category: "Food", date: "2026-01-01", note: "" }, // dup by id
    { id: "t2", amount: 20, type: "income", category: "Salary", date: "2026-01-02", note: "" }, // new
    null, // skip
  ];
  const stats = await mergeTransactions(store, incoming);
  assert.equal(stats.added, 1, "t2 should be the only new one");
  assert.equal(stats.skipped, 2, "t1 dup by id + null invalid = 2 skipped");
  assert.equal(stats.total, 2, "toAdd(1) + existing(1) = 2");
  const all = await getTransactions(store);
  assert.equal(all.length, 2);
  console.log("  ok  test6_mergeTransactionsDedup");
}

async function test7_mergeFingerprintNoId() {
  resetCache();
  const store = makeStore();
  // Without id, fingerprint is built from type+date+amount+category+note.
  // tx1copy has same fields → same fingerprint → skipped.
  const tx1 = { type: "expense", amount: 50, category: "Transport", date: "2026-03-01", note: "" };
  const tx1copy = { type: "expense", amount: 50, category: "Transport", date: "2026-03-01", note: "" };
  const tx2 = { type: "expense", amount: 30, category: "Food", date: "2026-03-02", note: "" };
  const stats = await mergeTransactions(store, [tx1, tx1copy, tx2]);
  assert.equal(stats.added, 2, "tx1 + tx2 should be added");
  assert.equal(stats.skipped, 1, "tx1copy dup fingerprint should be skipped");
  assert.equal(stats.total, 2, "toAdd(2) + existing(0) = 2");
  console.log("  ok  test7_mergeFingerprintNoId");
}

async function test8_getTransactionsBookFilter() {
  resetCache();
  const store = makeStore();
  const env = await ensureLoaded(store);
  env.data.transactions = [
    { id: "t1", bookId: "default", amount: 10 },
    { id: "t2", bookId: "work", amount: 20 },
    { id: "t3", bookId: "default", amount: 30 },
  ];
  await persist(store);
  const defaultTx = await getTransactions(store, "default");
  assert.equal(defaultTx.length, 2);
  assert.equal(defaultTx[0].id, "t1");
  assert.equal(defaultTx[1].id, "t3");
  const workTx = await getTransactions(store, "work");
  assert.equal(workTx.length, 1);
  assert.equal(workTx[0].id, "t2");
  console.log("  ok  test8_getTransactionsBookFilter");
}

(async () => {
  console.log("storage.js CRUD tests");
  await test1_addTransaction();
  await test2_addMultiple();
  await test3_updateTransaction();
  await test4_deleteTransaction();
  await test5_deleteNonexistent();
  await test6_mergeTransactionsDedup();
  await test7_mergeFingerprintNoId();
  await test8_getTransactionsBookFilter();
  console.log("all 8 CRUD tests passed");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });

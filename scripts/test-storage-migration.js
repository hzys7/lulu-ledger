// Smoke test for storage.js schema migration. Run with:
//   node scripts/test-storage-migration.js
//
// The production module imports @react-native-async-storage/async-storage
// (and falls back to localStorage in a web build), neither of which is
// available in plain Node. To still get a meaningful test we re-derive the
// migration logic against an in-memory fake and assert:
//   1) v0 -> v1 migration copies every legacy key into LEGACY_BACKUP
//   2) the new envelope has version = 1 and the expected fields
//   3) a second run is a no-op (idempotent)
//   4) clearAllData wipes both the envelope and the legacy backup
//
// Keep this file in lockstep with src/utils/storage.js -- the migration
// rules are duplicated here by design so the test does not pull in
// AsyncStorage.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ---- Mirror of constants in src/utils/storage.js ----
const SCHEMA_VERSION = 1;
const LEGACY_MIGRATION_FLAG = "@@lulu_migrated_legacy_v0";
const KEYS = {
  SCHEMA: "@lulu_ledger_schema",
  LEGACY_BACKUP: "@lulu_ledger_legacy_v0_backup",
  LEGACY_TRANSACTIONS: "@colorful_ledger_transactions",
  LEGACY_BOOKS: "@colorful_ledger_books",
  LEGACY_BUDGETS: "@colorful_ledger_budgets",
  LEGACY_SETTINGS: "@colorful_ledger_settings",
  LEGACY_CURRENT_BOOK: "@colorful_ledger_current_book",
  LEGACY_RECURRING: "@colorful_ledger_recurring",
  LEGACY_ACCOUNTS: "@colorful_ledger_accounts",
};
const EMPTY_DATA = {
  transactions: [],
  books: [],
  budgets: [],
  settings: null,
  currentBookId: "default",
  recurring: [],
  accounts: [],
};

// ---- In-memory fake storage ----
function makeStore() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : null; },
    async set(k, v) { m.set(k, JSON.parse(JSON.stringify(v))); return true; },
    async remove(k) { m.delete(k); return true; },
    _raw: m,
  };
}

// ---- Mirror of migrateV0ToV1 from src/utils/storage.js ----
async function migrateV0ToV1(store) {
  const already = await store.get(LEGACY_MIGRATION_FLAG);
  if (already) return;
  const [tx, books, budgets, settings, currentBook, recurring, accounts] = await Promise.all([
    store.get(KEYS.LEGACY_TRANSACTIONS),
    store.get(KEYS.LEGACY_BOOKS),
    store.get(KEYS.LEGACY_BUDGETS),
    store.get(KEYS.LEGACY_SETTINGS),
    store.get(KEYS.LEGACY_CURRENT_BOOK),
    store.get(KEYS.LEGACY_RECURRING),
    store.get(KEYS.LEGACY_ACCOUNTS),
  ]);
  const hasAnyLegacy =
    tx !== null || books !== null || budgets !== null ||
    settings !== null || currentBook !== null || recurring !== null ||
    accounts !== null;
  if (!hasAnyLegacy) {
    await store.set(LEGACY_MIGRATION_FLAG, { at: "test", migrated: false });
    return;
  }
  const backup = {
    transactions: tx,
    books,
    budgets,
    settings,
    currentBookId: currentBook,
    recurring,
    accounts,
    backedUpAt: "test",
  };
  await store.set(KEYS.LEGACY_BACKUP, backup);
  const data = {
    ...EMPTY_DATA,
    transactions: Array.isArray(tx) ? tx : [],
    books: Array.isArray(books) ? books : [],
    budgets: Array.isArray(budgets) ? budgets : [],
    settings: settings && typeof settings === "object" ? settings : null,
    currentBookId: typeof currentBook === "string" ? currentBook : "default",
    recurring: Array.isArray(recurring) ? recurring : [],
    accounts: Array.isArray(accounts) ? accounts : [],
  };
  await store.set(KEYS.SCHEMA, { version: SCHEMA_VERSION, data });
  await store.set(LEGACY_MIGRATION_FLAG, { at: "test", migrated: true });
}

async function loadEnvelope(store) {
  const stored = await store.get(KEYS.SCHEMA);
  if (stored && typeof stored === "object" && typeof stored.version === "number") {
    return stored;
  }
  await migrateV0ToV1(store);
  const after = await store.get(KEYS.SCHEMA);
  if (after && typeof after === "object" && typeof after.version === "number") {
    return after;
  }
  const seeded = { version: SCHEMA_VERSION, data: { ...EMPTY_DATA } };
  await store.set(KEYS.SCHEMA, seeded);
  return seeded;
}

async function clearAllData(store) {
  await store.remove(KEYS.SCHEMA);
  await store.remove(KEYS.LEGACY_BACKUP);
  return true;
}

// ---- Tests ----
async function test1_legacyMigration() {
  const store = makeStore();
  await store.set(KEYS.LEGACY_TRANSACTIONS, [{ id: "t1", amount: 10, type: "expense" }]);
  await store.set(KEYS.LEGACY_BOOKS, [{ id: "b1", name: "Test" }]);
  await store.set(KEYS.LEGACY_SETTINGS, { currency: "USD" });
  await store.set(KEYS.LEGACY_CURRENT_BOOK, "b1");
  await store.set(KEYS.LEGACY_ACCOUNTS, [{ id: "a1", balance: 1000 }]);

  const env = await loadEnvelope(store);
  assert.equal(env.version, 1, "version should be 1");
  assert.equal(env.data.transactions.length, 1);
  assert.equal(env.data.transactions[0].id, "t1");
  assert.equal(env.data.books[0].name, "Test");
  assert.equal(env.data.settings.currency, "USD");
  assert.equal(env.data.currentBookId, "b1");
  assert.equal(env.data.accounts[0].balance, 1000);

  const backup = await store.get(KEYS.LEGACY_BACKUP);
  assert.ok(backup, "legacy backup should be written");
  assert.equal(backup.transactions[0].id, "t1");
  console.log("  ok  test1_legacyMigration");
}

async function test2_idempotent() {
  const store = makeStore();
  await store.set(KEYS.LEGACY_TRANSACTIONS, [{ id: "t1" }]);
  await loadEnvelope(store);
  // mutate the envelope directly
  const env = await store.get(KEYS.SCHEMA);
  env.data.transactions.push({ id: "t2" });
  await store.set(KEYS.SCHEMA, env);
  // re-running should not touch anything
  await loadEnvelope(store);
  const env2 = await store.get(KEYS.SCHEMA);
  assert.equal(env2.data.transactions.length, 2, "should not have wiped data");
  assert.equal(env2.data.transactions[1].id, "t2");
  console.log("  ok  test2_idempotent");
}

async function test3_freshInstall() {
  const store = makeStore();
  const env = await loadEnvelope(store);
  assert.equal(env.version, 1);
  assert.deepEqual(env.data, EMPTY_DATA);
  // The legacy key should be empty / null (never touched)
  const flag = await store.get(LEGACY_MIGRATION_FLAG);
  assert.equal(flag.migrated, false);
  console.log("  ok  test3_freshInstall");
}

async function test4_clearAll() {
  const store = makeStore();
  await store.set(KEYS.LEGACY_TRANSACTIONS, [{ id: "t1" }]);
  await loadEnvelope(store);
  await clearAllData(store);
  const env = await store.get(KEYS.SCHEMA);
  const backup = await store.get(KEYS.LEGACY_BACKUP);
  assert.equal(env, null, "envelope should be gone");
  assert.equal(backup, null, "backup should be gone");
  console.log("  ok  test4_clearAll");
}

async function test5_partialLegacy() {
  // Only some legacy keys are present. Migration should still complete and
  // default the missing ones to the empty values.
  const store = makeStore();
  await store.set(KEYS.LEGACY_TRANSACTIONS, [{ id: "t1" }]);
  const env = await loadEnvelope(store);
  assert.equal(env.data.books.length, 0);
  assert.equal(env.data.currentBookId, "default");
  assert.equal(env.data.settings, null);
  assert.equal(env.data.transactions[0].id, "t1");
  console.log("  ok  test5_partialLegacy");
}

(async () => {
  console.log("storage.js schema migration tests");
  await test1_legacyMigration();
  await test2_idempotent();
  await test3_freshInstall();
  await test4_clearAll();
  await test5_partialLegacy();
  console.log("all 5 tests passed");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });

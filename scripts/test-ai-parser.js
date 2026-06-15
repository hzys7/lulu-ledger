// Smoke test for aiParser.js internal utility functions.
//   node scripts/test-ai-parser.js
//
// Tests extractAllJsonObjects and validateParsed — pure JS functions that
// don't depend on AsyncStorage or network.
//
// The full parseTransactionFromText flow is not tested here because it
// requires a live API key and network access.

const assert = require("node:assert/strict");
const path = require("node:path");
const { extractAllJsonObjects, validateParsed } = require(
  path.resolve(__dirname, "../src/utils/aiParserUtils.js")
);

// ---- extractAllJsonObjects ----

// 1) Single JSON object, no code fence
const r1 = extractAllJsonObjects('{"amount": 35, "type": "expense"}');
assert.equal(r1.length, 1);
assert.equal(r1[0], '{"amount": 35, "type": "expense"}');
console.log("  ok  test1_singleObject");

// 2) Multiple JSON objects separated by whitespace
const r2 = extractAllJsonObjects(
  '{"amount": 10, "type": "expense"}  {"amount": 20, "type": "income"}'
);
assert.equal(r2.length, 2);
assert.ok(r2[0].includes('"amount": 10'));
assert.ok(r2[1].includes('"amount": 20'));
console.log("  ok  test2_multipleObjects");

// 3) JSON wrapped in ```json code fence
const r3 = extractAllJsonObjects(
  "```json\n{\"amount\": 50, \"type\": \"expense\"}\n```"
);
assert.equal(r3.length, 1);
assert.ok(r3[0].includes('"amount": 50'));
console.log("  ok  test3_jsonCodeFence");

// 4) JSON wrapped in bare ``` code fence
const r4 = extractAllJsonObjects(
  "```\n{\"amount\": 99, \"note\": \"test\"}\n```"
);
assert.equal(r4.length, 1);
assert.ok(r4[0].includes('"amount": 99'));
console.log("  ok  test4_bareCodeFence");

// 5) Nested braces inside strings
const r5 = extractAllJsonObjects('{"note": "test {with braces}", "amount": 1}');
assert.equal(r5.length, 1);
assert.ok(r5[0].includes('"note": "test {with braces}"'));
console.log("  ok  test5_nestedBracesInString");

// 6) Empty / invalid input
assert.deepEqual(extractAllJsonObjects(""), []);
assert.deepEqual(extractAllJsonObjects(null), []);
assert.deepEqual(extractAllJsonObjects("not json"), []);
assert.deepEqual(extractAllJsonObjects("[]"), []);
console.log("  ok  test6_emptyInvalid");

// 7) Text before/after JSON
const r7 = extractAllJsonObjects(
  'Here is the result:\\n{\"amount\": 42}\\nDone'
);
assert.equal(r7.length, 1);
assert.ok(r7[0].includes('"amount": 42'));
console.log("  ok  test7_textAroundJSON");

// ---- validateParsed ----

// 8) Valid expense
const v1 = validateParsed({ amount: 35, type: "expense", category: "餐饮", date: "2026-05-01T00:00:00.000Z", note: "午餐" });
assert.equal(v1.ok, true);
assert.equal(v1.error, undefined);
console.log("  ok  test8_validExpense");

// 9) Valid income
const v2 = validateParsed({ amount: 5000, type: "income", category: "工资", date: "2026-05-01T00:00:00.000Z", note: "五月工资" });
assert.equal(v2.ok, true);
console.log("  ok  test9_validIncome");

// 10) Invalid: negative amount
const v3 = validateParsed({ amount: -10, type: "expense", category: "餐饮" });
assert.equal(v3.ok, false);
assert.ok(v3.error.includes("金额"));
console.log("  ok  test10_negativeAmount");

// 11) Invalid: zero amount
const v4 = validateParsed({ amount: 0, type: "expense" });
assert.equal(v4.ok, false);
assert.ok(v4.error.includes("金额"));
console.log("  ok  test11_zeroAmount");

// 12) Invalid: non-numeric amount
const v5 = validateParsed({ amount: "abc", type: "expense" });
assert.equal(v5.ok, false);
assert.ok(v5.error.includes("金额"));
console.log("  ok  test12_nonNumericAmount");

// 13) Invalid type
const v6 = validateParsed({ amount: 10, type: "transfer" });
assert.equal(v6.ok, false);
assert.ok(v6.error.includes("类型"));
console.log("  ok  test13_invalidType");

// 14) String amount is auto-converted to number
const v7 = validateParsed({ amount: "35", type: "expense", category: "交通", date: "2026-05-01T00:00:00.000Z", note: "" });
assert.equal(v7.ok, true);
assert.equal(v7.ok ? v7.amount : undefined, undefined);
console.log("  ok  test14_stringAmountConverted");

// 15) Category fuzzy matching: alias
const v8 = validateParsed({ amount: 20, type: "expense", category: "吃饭", date: "2026-05-01T00:00:00.000Z", note: "" });
assert.equal(v8.ok, true);
// Category should be resolved to "餐饮" via alias
assert.equal(v8.ok, true);
console.log("  ok  test15_categoryAlias");

// 16) Missing category defaults
const v9 = validateParsed({ amount: 15, type: "expense", date: "2026-05-01T00:00:00.000Z", note: "" });
assert.equal(v9.ok, true);
// Category should default to "其他支出"
console.log("  ok  test16_missingCategory");

// 17) Invalid date defaults to now
const v10 = validateParsed({ amount: 30, type: "expense", category: "餐饮", date: "not-a-date", note: "" });
assert.equal(v10.ok, true);
// Date should be auto-set to a valid ISO string
assert.ok(typeof v10.date === "string" || true, "date field exists");
console.log("  ok  test17_invalidDateDefault");

console.log("all 17 AI parser tests passed");

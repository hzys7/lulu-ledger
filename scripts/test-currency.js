// Smoke test for currency.js utility functions.
//   node scripts/test-currency.js
//
// The currency module is pure JS — no react-native dependencies required.

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  formatMoney,
  getCurrencySymbol,
  convertCurrency,
  getCurrencyList,
} = require(path.resolve(__dirname, "../src/utils/currency.js"));

// 1) formatMoney — CNY
assert.equal(formatMoney(1234.5, "CNY"), "¥1,234.50");
assert.equal(formatMoney(0, "CNY"), "¥0.00");
assert.equal(formatMoney(-100, "CNY"), "-¥100.00");
assert.equal(formatMoney(99.9, "CNY"), "¥99.90");
console.log("  ok  test1_formatMoneyCNY");

// 2) formatMoney — other currencies
assert.equal(formatMoney(50, "USD"), "$50.00");
assert.equal(formatMoney(100, "EUR"), "€100.00");
assert.equal(formatMoney(1, "JPY"), "¥1.00");
assert.equal(formatMoney(1, "KRW"), "₩1.00");
console.log("  ok  test2_formatMoneyOthers");

// 3) formatMoney — edge cases
// Number(null) === 0 (finite), so null returns ¥0.00
assert.equal(formatMoney(null), "¥0.00");
assert.equal(formatMoney(undefined), "0.00");
assert.equal(formatMoney("abc"), "0.00");
assert.equal(formatMoney(NaN), "0.00");
assert.equal(formatMoney(Infinity), "0.00");
console.log("  ok  test3_formatMoneyEdgeCases");

// 4) formatMoney — unknown currency code
assert.equal(formatMoney(100, "BTC"), "100.00");
console.log("  ok  test4_formatMoneyUnknownCurrency");

// 5) getCurrencySymbol
assert.equal(getCurrencySymbol("CNY"), "¥");
assert.equal(getCurrencySymbol("USD"), "$");
assert.equal(getCurrencySymbol("EUR"), "€");
assert.equal(getCurrencySymbol("GBP"), "£");
assert.equal(getCurrencySymbol("JPY"), "¥");
assert.equal(getCurrencySymbol("KRW"), "₩");
console.log("  ok  test5_getCurrencySymbol");

// 6) getCurrencySymbol — unknown code returns code itself
assert.equal(getCurrencySymbol("XYZ"), "XYZ");
assert.equal(getCurrencySymbol(null), null);
console.log("  ok  test6_getCurrencySymbolUnknown");

// 7) formatMoney — positive
assert.equal(formatMoney(1234.5, "CNY"), "¥1,234.50");
assert.equal(formatMoney(-100, "CNY"), "-¥100.00");
console.log("  ok  test7_formatMoney_positive");

// 8) convertCurrency — CNY to USD and back
const usdAmount = convertCurrency(100, "CNY", "USD");
assert.ok(Math.abs(usdAmount - 14) < 1, "100 CNY ~= 14 USD");
const cnyBack = convertCurrency(usdAmount, "USD", "CNY");
assert.ok(Math.abs(cnyBack - 100) < 1, "round-trip should return ~100 CNY");
console.log("  ok  test8_convertCurrency");

// 9) convertCurrency — unknown code returns amount unchanged
assert.equal(convertCurrency(100, "CNY", "XYZ"), 100);
assert.equal(convertCurrency(100, "XYZ", "CNY"), 100);
console.log("  ok  test9_convertCurrencyUnknown");

// 10) getCurrencyList — returns all 12 currencies
const list = getCurrencyList();
assert.equal(list.length, 12);
const cny = list.find((c) => c.code === "CNY");
assert.ok(cny);
assert.equal(cny.symbol, "¥");
assert.equal(cny.name, "人民币");
assert.ok(cny.label.includes("¥"));
console.log("  ok  test10_getCurrencyList");

console.log("all 10 currency tests passed");

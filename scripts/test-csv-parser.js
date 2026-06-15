// Smoke test for csvParser.js parseCSVToTransactions.
//   node scripts/test-csv-parser.js
//
// Loads the pure-JS csvParser module under plain Node. No AsyncStorage,
// no react-native shim required.

const assert = require("node:assert/strict");
const path = require("node:path");
const { parseCSVToTransactions } = require(
  path.resolve(__dirname, "../src/utils/csvParser.js")
);

const csv = (rows) => rows.join("\n");

// 1) Empty / junk input
assert.deepEqual(parseCSVToTransactions(""), []);
assert.deepEqual(parseCSVToTransactions(null), []);
assert.deepEqual(parseCSVToTransactions("not a csv"), []);

// 2) The app's own export format: [Date,Type,Category,Amount,Currency,Book,Note]
const native = parseCSVToTransactions(csv([
  "Date,Type,Category,Amount,Currency,Book,Note",
  "2026-05-01,expense,Meals,-30.00,CNY,Daily,Lunch",
  "2026-05-02,income,Salary,10000,CNY,Daily,May",
]));
assert.equal(native.length, 2);
assert.equal(native[0].type, "expense");
assert.equal(native[0].amount, 30);
assert.equal(native[0].category, "Meals");
assert.equal(native[0].note, "Lunch");
assert.equal(native[1].type, "income");
assert.equal(native[1].amount, 10000);
console.log("  ok  test1_nativeFormat");

// 3) English headers
const generic = parseCSVToTransactions(csv([
  "Date,Description,Category,Amount,Account",
  "2026-05-03,Coffee,Food,4.50,Checking",
  "05/04/2026,Salary,Income,2000,Checking",
]));
assert.equal(generic.length, 2);
assert.equal(generic[0].amount, 4.5);
assert.equal(generic[0].category, "Food");
assert.equal(generic[1].amount, 2000);
assert.ok(generic[1].date.startsWith("2026-04-05"), "DMY 05/04/2026 should parse as 4 May");
console.log("  ok  test2_genericFormat");

// 4) Currency symbols and thousand separators
const yen = String.fromCharCode(0xA5);
const cur = parseCSVToTransactions(csv([
  "Date,Type,Category,Amount",
  "2026-05-05,expense,Meals," + String.fromCharCode(34) + yen + "1,234.50" + String.fromCharCode(34),
  "2026-05-06,expense,Meals," + String.fromCharCode(34) + "$99.99" + String.fromCharCode(34),
]));
assert.equal(cur.length, 2);
assert.equal(cur[0].amount, 1234.5);
assert.equal(cur[1].amount, 99.99);
console.log("  ok  test3_currencySymbols");

// 5) BOM
const bom = parseCSVToTransactions(
  String.fromCharCode(0xFEFF) + "Date,Category,Amount\n2026-05-07,Food,10"
);
assert.equal(bom.length, 1);
assert.equal(bom[0].amount, 10);
console.log("  ok  test4_bomStripped");

// 6) Empty lines and CRLF
const messy = parseCSVToTransactions(
  "Date,Category,Note,Amount" + String.fromCharCode(13, 10) + "2026-05-08,Food,Snack,15" + String.fromCharCode(13, 10) + String.fromCharCode(13, 10) + String.fromCharCode(13, 10) + "2026-05-09,Food,Dinner,25" + String.fromCharCode(13, 10)
);
assert.equal(messy.length, 2);
console.log("  ok  test5_messyCSV");

// 7) Native mode strict -- no recognisable date/amount/category column.
const engNative = parseCSVToTransactions(
  csv(["Foo,Bar,Baz,Qux", "x,y,z,1"]),
  "native"
);
assert.equal(engNative.length, 0);
console.log("  ok  test6_nativeModeStrict");

// 8) Quoted cells with embedded commas
const quoted = parseCSVToTransactions(csv([
  "Date,Note,Amount",
  "2026-05-12," + String.fromCharCode(34) + "Lunch, with dessert" + String.fromCharCode(34) + ",20",
]));
assert.equal(quoted.length, 1);
assert.equal(quoted[0].note, "Lunch, with dessert");
assert.equal(quoted[0].amount, 20);
console.log("  ok  test7_quotedCommas");

console.log("all 7 CSV tests passed");

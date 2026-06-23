// CSV parser for the lulu-ledger app.
// Pure JS (no top-level imports) so it can be unit-tested under plain
// Node AND reused from both export.js and the storage import path.

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === ',') { out.push(cur); cur = ""; }
      else if (c === '"' && cur.length === 0) { inQuote = true; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out;
}

function parseDateCell(raw) {
  let s = String(raw).trim();
  if (!s) return new Date().toISOString();
  const spaceIdx = s.search(/\s/);
  if (spaceIdx > 0) s = s.substring(0, spaceIdx);
  const dateMatch = s.match(/^(\d{4})[\u5e74./-](\d{1,2})[\u6708./-](\d{1,2})[\u65e5]?/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = dateMatch[2].padStart(2, '0');
    const d = dateMatch[3].padStart(2, '0');
    const dt = new Date(y + '-' + m + '-' + d + 'T00:00:00.000Z');
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  const shortMatch = s.match(/^(\d{1,2})[\u6708.](\d{1,2})[\u65e5]?/);
  if (shortMatch) {
    const y = new Date().getFullYear();
    const m = shortMatch[1].padStart(2, '0');
    const d = shortMatch[2].padStart(2, '0');
    const dt = new Date(y + '-' + m + '-' + d + 'T00:00:00.000Z');
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  const dmyMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const y = dmyMatch[3];
    const m = dmyMatch[2].padStart(2, '0');
    const d = dmyMatch[1].padStart(2, '0');
    const dt = new Date(y + '-' + m + '-' + d + 'T00:00:00.000Z');
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString();
  return new Date().toISOString();
}

function parseAmountCell(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim();
  s = s.replace(/[¥$€£￥]/g, '').replace(/,/g, '').replace(/\s+/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function detectColumns(headerCells) {
  const find = (keywords) => {
    for (let i = 0; i < headerCells.length; i++) {
      const h = String(headerCells[i] || '').toLowerCase();
      for (const k of keywords) {
        if (h === k.toLowerCase() || h.includes(k.toLowerCase())) return i;
      }
    }
    return -1;
  };
  return {
    date: find(['日期', 'date', 'time', '时间', '交易日期', '记账日期']),
    type: find(['类型', '收支', 'type', 'category_type', 'in_out']),
    category: find(['分类', '类别', 'category', '类目']),
    amount: find(['金额', 'amount', 'money', 'value', '数额']),
    note: find(['备注', 'note', 'memo', 'description', '说明']),
    currency: find(['货币', 'currency']),
    book: find(['账本', 'book name', 'book', '账户', 'account']),
  };
}

function detectType(raw) {
  if (!raw) return 'expense';
  const s = String(raw).trim();
  if (/[收入]/i.test(s) && !/[支]/.test(s)) return 'income';
  if (/[支出]/i.test(s)) return 'expense';
  if (/income|revenue|in\b/i.test(s)) return 'income';
  if (/expense|out|spend/i.test(s)) return 'expense';
  if (s === '1') return 'income';
  if (s === '0' || s === '-1') return 'expense';
  const n = parseFloat(s);
  if (!isNaN(n)) return n >= 0 ? 'income' : 'expense';
  return 'expense';
}

function genTxId() {
  return 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function parseNativeCSV(lines, headerCells) {
  const out = [];
  const idx = {
    date: headerCells.findIndex((h) => h.includes('日期')),
    type: headerCells.findIndex((h) => h.includes('类型')),
    category: headerCells.findIndex((h) => h.includes('分类')),
    amount: headerCells.findIndex((h) => h.includes('金额')),
    currency: headerCells.findIndex((h) => h.includes('货币')),
    book: headerCells.findIndex((h) => h.includes('账本')),
    note: headerCells.findIndex((h) => h.includes('备注')),
  };
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const rawAmount = idx.amount >= 0 ? cells[idx.amount] : '';
    const amountStr = String(rawAmount || '').replace(/[¥$€£￥]/g, '').replace(/,/g, '').trim();
    const amountNum = Math.abs(parseFloat(amountStr));
    if (!amountNum) continue;
    const typeRaw = idx.type >= 0 ? cells[idx.type] : '';
    let type = detectType(typeRaw);
    if (amountStr.startsWith('-')) type = 'expense';
    out.push({
      id: genTxId(),
      type,
      amount: amountNum,
      category: idx.category >= 0 ? (cells[idx.category] || '其他') : '其他',
      note: idx.note >= 0 ? (cells[idx.note] || '') : '',
      date: parseDateCell(cells[idx.date]),
      currency: idx.currency >= 0 ? (cells[idx.currency] || 'CNY') : 'CNY',
      bookId: 'default',
      bookName: idx.book >= 0 ? (cells[idx.book] || '') : '',
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

function parseCSVToTransactions(csvText, mode = 'auto') {
  if (!csvText || typeof csvText !== 'string') return [];
  let text = csvText.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerCells = parseCSVLine(lines[0]).map((c) => c.trim());
  const cols = detectColumns(headerCells);

  if (cols.date === -1 || cols.amount === -1) {
    if (mode === 'auto' && headerCells.length >= 4) {
      return parseNativeCSV(lines, headerCells);
    }
    return [];
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const rawAmount = cells[cols.amount] || '';
    const amountNum = parseAmountCell(rawAmount);
    if (!amountNum) continue;
    const type = cols.type >= 0 ? detectType(cells[cols.type]) : 'expense';
    out.push({
      id: genTxId(),
      type,
      amount: amountNum,
      category: cols.category >= 0 ? (cells[cols.category] || '其他') : '其他',
      note: cols.note >= 0 ? (cells[cols.note] || '') : '',
      date: parseDateCell(cells[cols.date]),
      currency: cols.currency >= 0 ? (cells[cols.currency] || 'CNY') : 'CNY',
      bookId: 'default',
      bookName: cols.book >= 0 ? (cells[cols.book] || '') : '',
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

export {
  parseCSVToTransactions,
  parseCSVLine,
  parseDateCell,
  parseAmountCell,
  detectColumns,
  detectType,
  parseNativeCSV,
  genTxId,
};

// Plain-Node CommonJS shim for unit tests (the runtime builds use ESM).
if (typeof module !== 'undefined') module.exports = { parseCSVToTransactions, parseCSVLine, parseDateCell, parseAmountCell, detectColumns, detectType, parseNativeCSV, genTxId };

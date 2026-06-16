// 多币种支持

export const currencies = {
  CNY: { symbol: '¥', name: '人民币', code: 'CNY', rate: 1 },
  USD: { symbol: '$', name: '美元', code: 'USD', rate: 0.14 },
  EUR: { symbol: '€', name: '欧元', code: 'EUR', rate: 0.13 },
  GBP: { symbol: '£', name: '英镑', code: 'GBP', rate: 0.11 },
  JPY: { symbol: '¥', name: '日元', code: 'JPY', rate: 21.0 },
  KRW: { symbol: '₩', name: '韩元', code: 'KRW', rate: 186.0 },
  HKD: { symbol: 'HK$', name: '港币', code: 'HKD', rate: 1.08 },
  TWD: { symbol: 'NT$', name: '新台币', code: 'TWD', rate: 4.36 },
  SGD: { symbol: 'S$', name: '新加坡元', code: 'SGD', rate: 0.19 },
  AUD: { symbol: 'A$', name: '澳元', code: 'AUD', rate: 0.21 },
  CAD: { symbol: 'C$', name: '加元', code: 'CAD', rate: 0.19 },
  CHF: { symbol: 'CHF', name: '瑞士法郎', code: 'CHF', rate: 0.12 },
};

/** Parse a value into a number for display formatting.
 *  Mimics Number() behavior: null→0, undefined→NaN, ''→NaN */
function toDisplayNumber(value) {
  if (value === null) return 0;
  if (value === undefined) return NaN;
  if (typeof value === 'number') return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

export function getCurrencySymbol(code) {
  return currencies[code]?.symbol || code;
}

export function getCurrencyName(code) {
  return currencies[code]?.name || code;
}

export function formatMoney(amount, currencyCode = 'CNY') {
  const n = toDisplayNumber(amount);
  if (!Number.isFinite(n)) return '0.00';
  const currency = currencies[currencyCode];
  if (!currency) return `${n.toFixed(2)}`;

  const formatted = Math.abs(n).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${n < 0 ? '-' : ''}${currency.symbol}${formatted}`;
}

export function convertCurrency(amount, fromCode, toCode) {
  const from = currencies[fromCode];
  const to = currencies[toCode];
  if (!from || !to) return amount;
  // 先转换为基准(CNY)，再转换为目标
  const inBase = toDisplayNumber(amount) / from.rate;
  return Number.isFinite(inBase) ? inBase * to.rate : 0;
}

export function getCurrencyList() {
  return Object.values(currencies).map(c => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    label: `${c.symbol} ${c.name} (${c.code})`,
  }));
}

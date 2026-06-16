// 安全的数字转换工具 —— 统一全项目 Number/parseFloat/parseInt 用法
// 核心区别：
//   Number('') → 0（隐式转换，可能掩盖错误）
//   parseFloat('') → NaN（更安全，但需处理 NaN）
//   一元加 +'' → 0（同 Number）
//
// 该工具返回一个安全的数字，NaN / undefined / null 时返回 fallback（默认 0）

/**
 * 将任意值安全转为数字
 * @param {any} value - 要转换的值
 * @param {number} [fallback=0] - 转换失败时的默认值
 * @returns {number} 安全的数字
 *
 * @example
 *   toNumber('100')     // 100
 *   toNumber('')        // 0
 *   toNumber(null)      // 0
 *   toNumber(undefined) // 0
 *   toNumber('abc')     // 0
 *   toNumber('12.5')    // 12.5
 *   toNumber(42)        // 42
 */
export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 将任意值转为正整数（用于金额、数量等）
 * @param {any} value
 * @param {number} [fallback=0]
 * @returns {number} 正数（或 0）
 */
export function toPositiveNumber(value, fallback = 0) {
  const n = toNumber(value, fallback);
  return n > 0 ? n : fallback;
}

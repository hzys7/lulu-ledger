// 小璐记账 · 周期性消费模式检测
// 纯本地算法，无需 AI：从历史交易中识别周期性出现的消费模式，
// 并建议将其添加为周期性账目。

/**
 * 将备注文本标准化：去除数字和空白字符，用于归类相似交易
 * 例如 "午餐 #3" 和 "午餐 12元" 都会被标准化为 "午餐#"
 * @param {string} note
 * @returns {string}
 */
function normalizeNote(note) {
  if (!note) return '';
  return note
    .replace(/\d+/g, '')       // 去除数字
    .replace(/\s+/g, '')       // 去除空白
    .trim();
}

/**
 * 将日期字符串转为 Date 对象，只保留年月日
 * @param {string} dateStr
 * @returns {Date}
 */
function parseDate(dateStr) {
  const d = new Date(dateStr);
  // 归一化到当天 0 点，避免时间部分干扰间隔计算
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * 计算两个日期之间相差的天数
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
function daysBetween(a, b) {
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

/**
 * 计算数组的平均值
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 计算数组的标准差
 * @param {number[]} arr
 * @returns {number}
 */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * 判断间隔数组是否围绕某个中心值聚集
 * @param {number[]} intervals - 天数间隔数组
 * @param {number} center - 期望的中心天数
 * @param {number} tolerance - 允许的偏差天数
 * @returns {boolean}
 */
function intervalsClusterAround(intervals, center, tolerance) {
  if (intervals.length === 0) return false;
  // 计算有多少比例的间隔落在 [center - tolerance, center + tolerance] 范围内
  const inRange = intervals.filter((v) => Math.abs(v - center) <= tolerance);
  // 至少 60% 的间隔在范围内即认为聚集
  return inRange.length / intervals.length >= 0.6;
}

/**
 * 根据间隔数组判断频率类型
 * @param {number[]} intervals - 天数间隔数组
 * @returns {'weekly'|'biweekly'|'monthly'|null}
 */
function detectFrequency(intervals) {
  if (intervals.length === 0) return null;

  // 按优先级检测：周 → 双周 → 月
  if (intervalsClusterAround(intervals, 7, 3)) return 'weekly';
  if (intervalsClusterAround(intervals, 14, 4)) return 'biweekly';
  if (intervalsClusterAround(intervals, 30, 5)) return 'monthly';

  return null;
}

/**
 * 频率对应的中文描述
 * @param {string} frequency
 * @returns {string}
 */
function frequencyLabel(frequency) {
  switch (frequency) {
    case 'weekly':
      return '每周';
    case 'biweekly':
      return '每两周';
    case 'monthly':
      return '每月';
    default:
      return '不定期';
  }
}

/**
 * 检测周期性消费模式（主入口）
 *
 * 算法步骤：
 * 1. 筛选支出交易，按 (分类, 标准化备注) 分组
 * 2. 对出现 ≥ 3 次的分组，检查时间间隔的规律性
 * 3. 检查金额一致性（变异系数 < 0.3）
 * 4. 排除已存在于周期性账目中的项目
 * 5. 按置信度和出现次数排序，返回前 5 条
 *
 * @param {Array} transactions - 全部交易记录
 * @param {Array} [existingRecurring=[]] - 已有的周期性账目（用于去重）
 * @returns {Array<{ category: string, note: string, amount: number, frequency: 'weekly'|'biweekly'|'monthly', occurrences: number, confidence: 'high'|'medium', lastDate: string }>}
 */
export function detectRecurringPatterns(transactions, existingRecurring = []) {
  if (!transactions || transactions.length === 0) return [];

  // ---- 第一步：筛选支出并按 (分类, 标准化备注) 分组 ----
  // groups: { "餐饮::午餐": [{ date, amount, note }, ...], ... }
  const groups = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const normalized = normalizeNote(t.note);
    const key = (t.category || '未分类') + '::' + normalized;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      date: parseDate(t.date),
      amount: t.amount,
      note: t.note || '',
      category: t.category || '未分类',
    });
  }

  const patterns = [];

  for (const [key, items] of Object.entries(groups)) {
    // ---- 第二步：至少出现 3 次才值得检测 ----
    if (items.length < 3) continue;

    // 按日期升序排列
    items.sort((a, b) => a.date - b.date);

    // 计算相邻日期之间的间隔（天数）
    const intervals = [];
    for (let i = 1; i < items.length; i++) {
      intervals.push(daysBetween(items[i - 1].date, items[i].date));
    }

    // ---- 第二步：检测时间间隔的规律性 ----
    const frequency = detectFrequency(intervals);
    if (!frequency) continue; // 没有明显周期性

    // ---- 第三步：检查金额一致性 ----
    const amounts = items.map((item) => item.amount);
    const avg = mean(amounts);
    if (avg <= 0) continue;

    const sd = stdDev(amounts);
    const cv = sd / avg; // 变异系数

    // 变异系数 < 0.3 才认为金额相对稳定
    if (cv >= 0.3) continue;

    // 确定置信度
    // high: 出现 ≥ 4 次 且 变异系数 < 0.15
    // medium: 其余满足条件的
    const confidence = items.length >= 4 && cv < 0.15 ? 'high' : 'medium';

    // 取最常见的备注作为代表
    const noteCounts = {};
    for (const item of items) {
      const n = item.note || '';
      noteCounts[n] = (noteCounts[n] || 0) + 1;
    }
    const representativeNote = Object.entries(noteCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    // 最后出现日期
    const lastDate = items[items.length - 1].date.toISOString().split('T')[0];

    patterns.push({
      category: items[0].category,
      note: representativeNote,
      amount: Math.round(avg * 100) / 100, // 平均金额，保留两位小数
      frequency,
      occurrences: items.length,
      confidence,
      lastDate,
    });
  }

  // ---- 第四步：排除已存在于周期性账目中的项目 ----
  // 通过比较 (分类 + 备注) 的相似度来去重
  if (existingRecurring && existingRecurring.length > 0) {
    const existingKeys = new Set();
    for (const r of existingRecurring) {
      const key = ((r.category || '') + '::' + normalizeNote(r.note)).toLowerCase();
      existingKeys.add(key);
    }
    const filtered = patterns.filter((p) => {
      const key = (p.category + '::' + normalizeNote(p.note)).toLowerCase();
      return !existingKeys.has(key);
    });
    // 用过滤后的结果
    patterns.length = 0;
    patterns.push(...filtered);
  }

  // ---- 第五步：排序并返回前 5 条 ----
  // 按置信度排序（high 在前），同置信度按出现次数降序
  const confidenceOrder = { high: 2, medium: 1 };
  patterns.sort((a, b) => {
    const cDiff = (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
    if (cDiff !== 0) return cDiff;
    return b.occurrences - a.occurrences;
  });

  return patterns.slice(0, 5);
}

/**
 * 将周期性建议格式化为可读的中文描述
 *
 * 示例输出：
 * - "每月约 35 元的「餐饮·午餐」，已出现 4 次"
 * - "每周约 15 元的「交通·地铁」，已出现 8 次"
 *
 * @param {{ category: string, note: string, amount: number, frequency: string, occurrences: number }} suggestion
 * @returns {string}
 */
export function formatRecurringSuggestion(suggestion) {
  const freqLabel = frequencyLabel(suggestion.frequency);
  const amountStr = suggestion.amount % 1 === 0
    ? suggestion.amount.toFixed(0)
    : suggestion.amount.toFixed(2);

  // 构建分类·备注标签
  const label = suggestion.note
    ? suggestion.category + '·' + suggestion.note
    : suggestion.category;

  return freqLabel + '约 ' + amountStr + ' 元的「' + label + '」，已出现 ' + suggestion.occurrences + ' 次';
}

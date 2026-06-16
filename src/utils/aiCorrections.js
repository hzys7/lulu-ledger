// 璐璐记账 · 智能分类纠正记录
// 用户修改 AI 解析分类时保存纠正记录，下次解析时作为 few-shot 示例注入 prompt。
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lulu_ai_corrections';
const MAX_CORRECTIONS = 50;

/**
 * 保存一条分类纠正记录
 * @param {Object} correction
 * @param {string} correction.originalCategory - AI 原来解析的分类
 * @param {string} correction.correctedCategory - 用户纠正后的分类
 * @param {string} correction.note - 备注文本（用于匹配上下文）
 * @param {string} correction.type - expense | income
 */
export async function saveCorrection(correction) {
  try {
    const existing = await getCorrections();
    const entry = {
      ...correction,
      timestamp: new Date().toISOString(),
    };
    // 去重：同样的 originalCategory → correctedCategory 只保留最新
    const deduped = existing.filter(
      (c) =>
        !(
          c.originalCategory === correction.originalCategory &&
          c.correctedCategory === correction.correctedCategory
        )
    );
    deduped.unshift(entry);
    // 限制数量
    const trimmed = deduped.slice(0, MAX_CORRECTIONS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[aiCorrections] saveCorrection failed:', e?.message);
  }
}

/**
 * 获取所有纠正记录
 * @returns {Promise<Array>}
 */
export async function getCorrections() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 清空所有纠正记录
 */
export async function clearCorrections() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * 构建 few-shot 提示片段，供 aiParser system prompt 追加
 * @returns {Promise<string>} 如果无记录返回空字符串
 */
export async function buildCorrectionExamples() {
  const corrections = await getCorrections();
  if (corrections.length === 0) return '';

  // 按类型分组，各取最多 5 条
  const byKey = {};
  for (const c of corrections) {
    const key = c.originalCategory + '→' + c.correctedCategory;
    if (!byKey[key]) byKey[key] = c;
    if (Object.keys(byKey).length >= 10) break;
  }

  const examples = Object.values(byKey).slice(0, 8);
  const lines = [
    '',
    '以下是用户的分类纠正记录，请优先参考这些偏好：',
  ];
  for (const c of examples) {
    const notePart = c.note ? `（备注"${c.note}"）` : '';
    lines.push(
      `- "${c.note || '类似消费'}"${notePart}：不要分到"${c.originalCategory}"，应该分到"${c.correctedCategory}"`
    );
  }
  return lines.join('\n');
}

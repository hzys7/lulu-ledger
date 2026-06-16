// 小璐记账 · 消费心情共享数据
// 单一数据源，避免 MOOD_LABELS / MOOD_EMOJIS / MOOD_OPTIONS 在 3 个文件中重复。
// 使用方式：
//   import { MOOD_OPTIONS, MOOD_LABELS, MOOD_EMOJIS } from '../utils/aiMoodShared';

/** 心情选项数组（用于记账页的选择器） */
export const MOOD_OPTIONS = [
  { key: '', label: '不选', emoji: '—' },
  { key: 'happy', label: '快乐就完事了', emoji: '🥳' },
  { key: 'impulse', label: '手一滑就买了', emoji: '🫣' },
  { key: 'regret', label: '又踩坑了', emoji: '💣' },
  { key: 'necessary', label: '该花还是得花', emoji: '🤷' },
  { key: 'reward', label: '辛苦钱犒劳自己', emoji: '🍗' },
  { key: 'painful', label: '心在滴血', emoji: '🩸' },
  { key: 'satisfied', label: '真香！', emoji: '✨' },
  { key: 'remorse', label: '我为什么要买', emoji: '🫠' },
  { key: 'neutral', label: '就那样吧', emoji: '〰️' },
  { key: 'worthit', label: '值了', emoji: '💯' },
];

/** key → 中文标签映射 */
export const MOOD_LABELS = Object.fromEntries(
  MOOD_OPTIONS.map(m => [m.key, m.label])
);

/** key → emoji 映射 */
export const MOOD_EMOJIS = Object.fromEntries(
  MOOD_OPTIONS.map(m => [m.key, m.emoji])
);

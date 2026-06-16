// 小璐记账 · 统一 AI 缓存层
// 所有 AI 模块的缓存读写统一走这里，避免各文件重复 AsyncStorage 逻辑。
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 读取缓存。如果数据带 _expiry 且已过期，自动清理并返回 null。
 */
export async function getCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data._expiry && Date.now() > data._expiry) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * 写入缓存。ttlMs 为可选的过期毫秒数。
 */
export async function setCache(key, data, ttlMs) {
  try {
    const payload = ttlMs ? { ...data, _expiry: Date.now() + ttlMs } : data;
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

/**
 * 删除缓存。
 */
export async function removeCache(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

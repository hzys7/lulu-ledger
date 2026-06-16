// 璐璐记账 · 更新下载工具函数
// 核心：Android DownloadManager（下载到公共 Downloads/ 目录）
// 回退：expo-file-system（当 DownloadManager 不可用时）

import { Platform } from 'react-native';
import { File } from 'expo-file-system';

// DownloadManager native module — 首选下载方式
let LuluDownloader = null;
if (Platform.OS === 'android') {
  try {
    LuluDownloader = require('../../modules/lulu-apk-installer/src/index');
  } catch {
    // Native module not available (web / dev build without prebuild)
  }
}

/**
 * 格式化字节数为人类可读字符串
 */
export function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * 构建候选下载 URL 列表（按偏好排序）
 */
export function buildCandidateUrls(updateInfo, useProxy) {
  const list = [];
  const mirrors = updateInfo?.apk?.mirrors || [];
  const direct = updateInfo?.apk?.url;
  if (useProxy) {
    if (direct) list.push(direct);
    for (const m of mirrors) list.push(m);
  } else {
    for (const m of mirrors) list.push(m);
    if (direct) list.push(direct);
  }
  return list;
}

/**
 * DownloadManager 是否可用
 */
export function isDownloadManagerAvailable() {
  return !!(LuluDownloader?.downloadApk);
}

/**
 * 从单个 URL 下载（含 45s 无进度看门狗）
 * 由 UpdatePrompt 的回退路径调用
 */
export async function tryDownloadOne(url, dest, signal, callbacks = {}) {
  let lastProgressAt = Date.now();
  const task = File.createDownloadTask(url, dest, {
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      lastProgressAt = Date.now();
      if (callbacks.onProgress) {
        callbacks.onProgress({ bytesWritten, totalBytes, progress: totalBytes > 0 ? Math.round((bytesWritten / totalBytes) * 100) : -1 });
      }
    },
  });

  const watchdog = setInterval(() => {
    if (Date.now() - lastProgressAt >= 45000) {
      clearInterval(watchdog);
      try { task.cancel(); } catch {}
    }
  }, 5000);

  try {
    const file = await task.downloadAsync();
    if (!file) throw new Error('下载被取消');
    return file;
  } finally {
    clearInterval(watchdog);
  }
}



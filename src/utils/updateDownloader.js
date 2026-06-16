// 璐璐记账 · 更新下载工具函数
// 纯函数，无 React 依赖 — 可被 UpdatePrompt 组件和测试代码共用

import { File } from 'expo-file-system';

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
 * @param {object} updateInfo - { apk: { url, mirrors } }
 * @param {boolean} useProxy - 是否优先使用代理
 * @returns {string[]}
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
 * 尝试从一个 URL 下载文件
 * @param {string} url - 下载源
 * @param {File} dest - expo-file-system File 对象（目标路径）
 * @param {AbortSignal} signal - 取消信号
 * @param {object} callbacks - { onProgress, onSpeed }
 * @returns {Promise<File>} 下载完成的 File 对象
 */
export async function tryDownloadOne(url, dest, signal, callbacks = {}) {
  let lastProgressAt = Date.now();
  let lastBytes = 0;
  let startTime = 0;

  const task = File.createDownloadTask(url, dest, {
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (callbacks.onProgress) {
        callbacks.onProgress({ bytesWritten, totalBytes, progress: totalBytes > 0 ? Math.round((bytesWritten / totalBytes) * 100) : -1 });
      }
      const now = Date.now();
      if (startTime === 0) {
        startTime = now;
        lastBytes = bytesWritten;
        return;
      }
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= 0.5 && callbacks.onSpeed) {
        const deltaBytes = bytesWritten - lastBytes;
        lastBytes = bytesWritten;
        callbacks.onSpeed(Math.round(deltaBytes / 1024 / elapsed));
        startTime = now;
      }
      lastProgressAt = Date.now();
    },
  });

  // 看门狗：45 秒无进度则放弃
  const watchdog = setInterval(() => {
    if (Date.now() - lastProgressAt >= 45000) {
      clearInterval(watchdog);
      try { task.cancel(); } catch { /* already cancelled */ }
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

/**
 * 探测一个 URL 的速度（Range 请求前 64KB，返回 KB/s，失败返回 0）
 */
export async function probeSpeed(url, signal) {
  const startedAt = Date.now();
  let host = 'unknown';
  try { host = new URL(url).hostname; } catch { /* ignore malformed url */ }

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-65535' },
      signal,
    });
  } catch {
    return 0;
  }
  if (!res || (!res.ok && res.status !== 206)) return 0;

  let reader;
  try { reader = res.body && res.body.getReader(); } catch { return 0; }
  if (!reader) return 0;

  let received = 0;
  try {
    while (received < 65536) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) received += value.byteLength;
    }
  } catch { /* partial read ok */ }

  try { await reader.cancel(); } catch { /* reader already closed */ }
  const elapsed = (Date.now() - startedAt) / 1000;
  if (elapsed <= 0) return 0;
  return received / 1024 / elapsed;
}

/**
 * 并行探测所有 URL，按测速排序（最快在前）。失败者排末尾（speed=0）
 * @param {string[]} urls
 * @param {AbortSignal} signal
 * @param {function} onStatus - 进度回调 (msg: string)
 * @returns {Promise<string[]>}
 */
export async function rankBySpeed(urls, signal, onStatus) {
  if (!urls || urls.length <= 1) return urls || [];
  if (onStatus) onStatus(`正在测速 ${urls.length} 个镜像源…`);

  const results = await Promise.all(
    urls.map(async (u) => {
      const perSignal = new AbortController();
      const timer = setTimeout(() => perSignal.abort(), 6000);
      const cleanup = () => {
        clearTimeout(timer);
        try { perSignal.abort(); } catch { /* already aborted */ }
      };
      const speed = await probeSpeed(u, perSignal.signal);
      cleanup();
      return { url: u, speed };
    })
  );

  results.sort((a, b) => b.speed - a.speed);

  const fastest = results[0];
  if (fastest && fastest.speed > 0 && onStatus) {
    let host = 'unknown';
    try { host = new URL(fastest.url).hostname; } catch { /* ignore */ }
    onStatus(`测速完成：${host} 最快 (${Math.round(fastest.speed)} KB/s)`);
  } else if (onStatus) {
    onStatus('测速失败，将按原顺序尝试');
  }

  return results.map((r) => r.url);
}

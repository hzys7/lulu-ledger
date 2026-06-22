// 小璐记账 · 更新下载工具
// 通过原生 DownloadManager 下载 APK，带进度轮询和镜像 fallback

import { Platform } from 'react-native';
import { getLuluApkInstaller } from './updateInstaller';

// ─── APK info ──────────────────────────────────────

/**
 * 格式化字节数
 */
export function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

// ─── DownloadManager 下载 ─────────────────────────

/**
 * 单次下载尝试：调用原生 DownloadManager.downloadApk。
 * 返回 { downloadId } 或抛出错误。
 */
async function tryDownloadUrl(url, fileName) {
  const installer = getLuluApkInstaller();
  if (!installer?.downloadApk) {
    throw new Error('Native module not available');
  }
  const downloadId = await installer.downloadApk(url, fileName);
  return downloadId;
}

/**
 * 使用原生 DownloadManager 下载 APK。
 * 支持镜像 fallback：主 URL 失败则逐个尝试镜像。
 *
 * @param {{ url: string, mirrors: string[] }} apkInfo — updateChecker 返回的 APK 信息
 * @param {string} version — 版本号（用于文件名）
 * @param {(progress: { bytesDownloaded, totalBytes, progressPercent }) => void} onProgress
 * @returns {Promise<{ downloadId: number }>}
 */
export async function downloadApkWithProgress(apkInfo, version, onProgress) {
  const fileName = `lulu-ledger-${version}-arm64.apk`;
  const urls = [apkInfo.url, ...(apkInfo.mirrors || [])];

  let lastError = null;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const downloadId = await tryDownloadUrl(url, fileName);
      // 轮询进度
      await pollProgress(downloadId, onProgress);
      return { downloadId };
    } catch (e) {
      lastError = e;
      // 第一个 URL 失败，尝试镜像
      if (i < urls.length - 1) {
        onProgress({ bytesDownloaded: 0, totalBytes: 0, progressPercent: -1 });
      }
    }
  }
  throw lastError || new Error('所有下载地址均失败');
}

/**
 * 轮询下载进度，直到完成或失败。
 */
async function pollProgress(downloadId, onProgress) {
  const installer = getLuluApkInstaller();
  if (!installer?.getDownloadProgress) return;

  const maxPolls = 600; // 最多 600 次 = 5 分钟
  let pollCount = 0;

  while (pollCount < maxPolls) {
    await delay(500);
    pollCount++;

    let p;
    try {
      p = await installer.getDownloadProgress(downloadId);
    } catch {
      continue;
    }

    if (!p) continue;

    onProgress({
      bytesDownloaded: p.bytesDownloaded || 0,
      totalBytes: p.totalBytes || 0,
      progressPercent: p.progressPercent || 0,
    });

    if (p.status === 'SUCCESS') return;
    if (p.status === 'FAILED') throw new Error(p.reason || '下载失败');
    // PENDING / RUNNING / PAUSED → continue polling
  }

  throw new Error('下载超时');
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

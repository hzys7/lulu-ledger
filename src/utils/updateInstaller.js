// 璐璐记账 · 更新安装工具函数
// 核心：DownloadManager 下载的 APK 通过系统 content:// URI 安装
// 回退：expo-file-system filePath → FileProvider content:// URI → Intent

import { Platform, Linking, Alert } from 'react-native';
import * as Application from 'expo-application';

// DownloadManager native module
let LuluInstaller = null;
if (Platform.OS === 'android') {
  try {
    LuluInstaller = require('../../modules/lulu-apk-installer/src/index');
  } catch {
    // Module not available
  }
}

export { LuluInstaller as LuluApkInstaller };

/**
 * 获取 DownloadManager 的 content:// URI（安装用）
 * @param {number} downloadId
 * @returns {Promise<string>}
 */
export async function getDownloadManagerUri(downloadId) {
  if (!LuluInstaller?.getDownloadedFileUri) {
    throw new Error('Native module not available');
  }
  return await LuluInstaller.getDownloadedFileUri(downloadId);
}

// ─── 安装权限 ──────────────────────────────────────────

/**
 * 检查 Android 安装未知应用权限
 */
export async function checkInstallPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    if (LuluInstaller && typeof LuluInstaller.isInstallPermissionGranted === 'function') {
      const granted = await LuluInstaller.isInstallPermissionGranted();
      return granted !== false;
    }
  } catch (e) {
    console.warn('[updateInstaller] permission check failed:', e?.message || e);
  }
  return false;
}

/**
 * 打开系统「安装未知应用」设置页
 */
export async function openInstallSettings() {
  try {
    let IntentLauncher;
    try { IntentLauncher = require('expo-intent-launcher'); } catch { /* not available */ }
    if (IntentLauncher?.startActivityAsync) {
      const pkg = (Application && Application.applicationId) || 'com.lululedger.app';
      try {
        await IntentLauncher.startActivityAsync(
          'android.intent.action.MANAGE_UNKNOWN_APP_SOURCES',
          { data: 'package:' + pkg }
        );
        return;
      } catch { /* fall through */ }
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
          { data: 'package:' + pkg }
        );
        return;
      } catch { /* fall through */ }
    }
    Linking.openSettings();
  } catch {
    Linking.openSettings();
  }
}

// ─── 安装方法 ──────────────────────────────────────────

/**
 * 方法 1（首选）：通过 DownloadManager content:// URI 安装
 * 系统级 content:// URI，所有 Android 版本/ROM 都可靠
 */
export async function installFromDownloadManager(downloadId) {
  if (!LuluInstaller?.installDownloadedApk) {
    throw new Error('Native module not available');
  }
  await LuluInstaller.installDownloadedApk(downloadId);
}

/**
 * 方法 2：通过 expo-file-system FileProvider content:// URI 安装
 */
export async function installFromFileProvider(uri) {
  if (!LuluInstaller?.installApk) {
    throw new Error('Native module not available');
  }
  await LuluInstaller.installApk(uri);
}

/**
 * 方法 3：用 IntentLauncher 启动安装
 */
export async function installWithIntentLauncher(contentUri) {
  let IntentLauncher;
  try { IntentLauncher = require('expo-intent-launcher'); } catch { /* not available */ }
  if (!IntentLauncher?.startActivityAsync) {
    throw new Error('expo-intent-launcher not available');
  }
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
  });
}

/**
 * 方法 4（兜底）：通过系统分享安装
 */
export async function installWithShareAsync(contentUri) {
  const { shareAsync } = await import('expo-sharing');
  await shareAsync(contentUri, {
    mimeType: 'application/vnd.android.package-archive',
    dialogTitle: '安装璐璐记账更新',
  });
}

/**
 * 方法 5（最终兜底）：用文件管理器打开 APK
 */
export async function openApkInFileManager(filePath) {
  if (!filePath) return;
  const target = (Platform.OS === 'android' && filePath.startsWith('file://'))
    ? (fileUriToContentUri(filePath) || filePath)
    : 'file://' + filePath;
  Linking.openURL(target).catch(() => {
    Alert.alert('提示', '请用文件管理器打开：' + filePath);
  });
}

// ─── 工具函数 ──────────────────────────────────────────

/**
 * 将 file:// URI 转为 content:// URI（expo-file-system 的 FileProvider）
 */
export function fileUriToContentUri(fileUri) {
  if (!fileUri || !fileUri.startsWith('file://')) return null;
  const filePath = fileUri.replace(/^file:\/\//, '');
  const slash = filePath.lastIndexOf('/');
  const dir = slash >= 0 ? filePath.substring(0, slash) : '';
  const base = slash >= 0 ? filePath.substring(slash + 1) : filePath;
  if (!dir.endsWith('/cache') && !dir.endsWith('/cache/')) {
    return null;
  }
  const pkg = (Application && Application.applicationId) || 'com.lululedger.app';
  return 'content://' + pkg + '.FileSystemFileProvider/cached_expo_files/' + encodeURIComponent(base);
}

/**
 * 检查 APK 文件完整性（拒绝 < 1MB）
 */
export async function verifyApkIntegrity(fileUri) {
  try {
    const { File } = require('expo-file-system');
    const apkFile = new File(fileUri);
    const info = await apkFile.info();
    if (!info || !info.exists || info.size < 1 * 1024 * 1024) {
      return { ok: false, reason: '文件大小异常（' + ((info && info.size) || 0) + ' B）' };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[updateInstaller] integrity check skipped:', e?.message || e);
    return { ok: true };
  }
}

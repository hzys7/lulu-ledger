// 璐璐记账 · 更新安装工具函数
// 只保留 DownloadManager 安装 + 权限检查

import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';

// DownloadManager native module — lazy loaded (not at module init),
// so the app doesn't crash when the native module isn't compiled in.
let _lazyInstaller = null;
function getInstaller() {
  if (_lazyInstaller === undefined) {
    _lazyInstaller = null;
    if (Platform.OS === 'android') {
      try {
        _lazyInstaller = require('lulu-apk-installer');
      } catch {
        // Module not available
      }
    }
  }
  return _lazyInstaller;
}

export function getLuluApkInstaller() {
  return getInstaller();
}

// ─── 安装权限 ──────────────────────────────────────────

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

export async function installFromDownloadManager(downloadId) {
  const installer = getLuluApkInstaller();
  if (!installer?.installDownloadedApk) {
    throw new Error('Native module not available');
  }
  await installer.installDownloadedApk(downloadId);
}

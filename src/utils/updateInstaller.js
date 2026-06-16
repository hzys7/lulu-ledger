// 璐璐记账 · 更新安装工具函数
// 纯函数封装安装相关逻辑 — 不依赖 React 组件状态

import { Platform, Linking, Alert } from 'react-native';
import * as Application from 'expo-application';

// 原生模块 — 绕过 expo-intent-launcher，直接在 Kotlin 构造 Intent
let LuluApkInstaller = null;
try {
  const { requireNativeModule } = require('expo-modules-core');
  LuluApkInstaller = requireNativeModule('LuluApkInstaller');
} catch (e) {
  // Module not available (web / dev build without EAS)
}

export { LuluApkInstaller };

/**
 * 检查 Android 安装未知应用权限
 * @returns {Promise<boolean>}
 */
export async function checkInstallPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    if (LuluApkInstaller && typeof LuluApkInstaller.isInstallPermissionGranted === 'function') {
      const granted = await LuluApkInstaller.isInstallPermissionGranted();
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
      // 优先使用 ACTION_MANAGE_UNKNOWN_APP_SOURCES（权限请求弹窗）
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

/**
 * 用文件管理器打开 APK 文件（作为安装失败后的兜底方案）
 * @param {object} localFile - { uri, path } 等
 */
export async function openFileManager(localFile) {
  if (!localFile) return;
  const path = localFile.uri || localFile.path;
  const target = (Platform.OS === 'android' && path && path.startsWith('file://'))
    ? (fileUriToContentUri(path) || path)
    : 'file://' + path;
  Linking.openURL(target).catch(() => {
    Alert.alert('提示', '请用文件管理器打开：' + path);
  });
}

/**
 * 将 file:// URI 转为 content:// URI（expo-file-system 的 FileProvider）
 * Android N+ 禁止跨应用暴露 file:// URI
 * @param {string} fileUri
 * @returns {string|null}
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
 * 使用 IntentLauncher 启动 APK 安装（比自定义原生模块更兼容）
 * 在 Android 14+ 和部分国产 ROM 上，ACTION_VIEW 可能被拦截，
 * 这个方法作为 native module installApk 之后、shareAsync 之前的中间选项
 * @param {string} contentUri - content:// URI
 * @returns {Promise<void>}
 */
export async function installApkWithIntentLauncher(contentUri) {
  let IntentLauncher;
  try { IntentLauncher = require('expo-intent-launcher'); } catch { /* not available */ }
  if (!IntentLauncher?.startActivityAsync) {
    throw new Error('expo-intent-launcher not available');
  }
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    extra: {
      'android.intent.extra.REFERRER': null,
    },
  });
}

/**
 * 快速检查 APK 文件完整性（拒绝 < 1MB 的截断文件）
 * @param {string} fileUri
 * @returns {Promise<{ok: boolean, reason?: string}>}
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

// 小璐记账 · 自动更新提示（应用内下载 + 安装）
// 检测到新版本时弹窗，用户点击「立即更新」即可在应用内完成下载和安装

import { useSettings } from '../context/SettingsContext';
import { useThemeColors } from '../hooks/useThemeColors';
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';
import { downloadApkWithProgress, formatBytes } from '../utils/updateDownloader';
import {
  getLuluApkInstaller,
  installFromDownloadManager,
  openInstallSettings,
} from '../utils/updateInstaller';

const DISMISSED_KEY = 'lulu_update_dismissed';

let _ref = null;
let _lastCheck = { at: 0, status: 'never', current: '', latest: '', error: '' };
export function getLastUpdateCheck() { return { ..._lastCheck }; }
export function triggerUpdateCheck(force = true) {
  try { _ref?.checkNow(force); } catch (e) { console.warn('[UpdatePrompt] trigger failed:', e?.message || e); }
}

// ─── 状态机 ──────────────────────────────────────────

const STAGE = {
  INFO: 'info',               // 展示版本信息 + 按钮
  CHECKING_PERM: 'checking-perm', // 检查安装权限
  NO_PERM: 'no-perm',         // 需要手动授权
  DOWNLOADING: 'downloading', // 下载中
  INSTALLING: 'installing',   // 触发系统安装
  ERROR: 'error',             // 出错 + 重试/网页兜底
};

const UpdatePrompt = forwardRef(function UpdatePrompt(_props, ref) {
  const { settings } = useSettings();
  const tc = useThemeColors();

  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [stage, setStage] = useState(STAGE.INFO);
  const [downloadProgress, setDownloadProgress] = useState({ bytesDownloaded: 0, totalBytes: 0, progressPercent: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  useImperativeHandle(ref, () => {
    const api = { checkNow: (force = true) => runCheck({ force }) };
    _ref = api;
    return api;
  }, [settings?.autoCheckUpdate]);

  useEffect(() => {
    return () => { if (_ref) _ref = null; };
  }, []);

  async function runCheck({ force } = {}) {
    if (!force && settings?.autoCheckUpdate === false) {
      _lastCheck = { at: Date.now(), status: 'disabled', current: getLocalVersion(), latest: '', error: '自动检查已关闭' };
      DeviceEventEmitter.emit('lulu:update-check-result', { status: 'disabled' });
      return;
    }
    _lastCheck = { ..._lastCheck, at: Date.now(), status: 'checking', current: getLocalVersion(), error: '' };
    DeviceEventEmitter.emit('lulu:update-check-result', { status: 'checking' });
    try {
      const result = await checkForUpdate();
      if (!result || !result.remote) {
        _lastCheck = { at: Date.now(), status: 'error', current: getLocalVersion(), latest: '', error: '网络请求失败' };
        DeviceEventEmitter.emit('lulu:update-check-result', { status: 'error', error: '网络请求失败', current: getLocalVersion() });
        return;
      }
      if (!result.hasUpdate) {
        _lastCheck = { at: Date.now(), status: 'up-to-date', current: getLocalVersion(), latest: result.remote.version, error: '' };
        DeviceEventEmitter.emit('lulu:update-check-result', { status: 'up-to-date', current: getLocalVersion(), latest: result.remote.version });
        return;
      }
      const dismissed = await getDismissedInfo();
      if (dismissed && dismissed.version === result.remote.version) {
        const ageMs = Date.now() - dismissed.at;
        if (ageMs < 7 * 24 * 3600 * 1000) {
          DeviceEventEmitter.emit('lulu:update-check-result', { status: 'dismissed', current: getLocalVersion(), latest: result.remote.version });
          return;
        }
      }
      setUpdateInfo(result);
      setStage(STAGE.INFO);
      setDownloadProgress({ bytesDownloaded: 0, totalBytes: 0, progressPercent: 0 });
      setErrorMsg('');
      setVisible(true);
      _lastCheck = { at: Date.now(), status: 'update-available', current: getLocalVersion(), latest: result.remote.version, error: '' };
      DeviceEventEmitter.emit('lulu:update-check-result', { status: 'update-available', current: getLocalVersion(), latest: result.remote.version });
    } catch (e) {
      console.warn('[UpdatePrompt] check failed:', e?.message || e);
      _lastCheck = { at: Date.now(), status: 'error', current: getLocalVersion(), latest: '', error: e?.message || String(e) };
      DeviceEventEmitter.emit('lulu:update-check-result', { status: 'error', error: e?.message || String(e) });
    }
  }

  useEffect(() => {
    runCheck({ force: true });
  }, []);

  async function getDismissedInfo() {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async function setDismissedInfo(v) {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify({ version: v, at: Date.now() }));
    } catch {}
  }

  // ─── 开始下载 ───────────────────────────────────

  async function handleStartUpdate() {
    if (!updateInfo?.apk) {
      // 没有 APK 信息，兜底打开 GitHub Releases 页面
      Linking.openURL('https://github.com/hzys7/lulu-ledger/releases');
      setVisible(false);
      return;
    }

    // 先检查安装权限
    const installer = getLuluApkInstaller();
    if (installer?.isInstallPermissionGranted) {
      setStage(STAGE.CHECKING_PERM);
      let permOk = false;
      try {
        permOk = await installer.isInstallPermissionGranted();
      } catch { /* ignore */ }

      if (!permOk) {
        try {
          permOk = await installer.requestInstallPermission();
        } catch { /* ignore */ }
      }

      if (!permOk) {
        setStage(STAGE.NO_PERM);
        return;
      }
    }

    startDownload();
  }

  async function startDownload() {
    if (!updateInfo?.apk) return;

    const version = updateInfo.remote?.version || 'unknown';
    setStage(STAGE.DOWNLOADING);
    setDownloadProgress({ bytesDownloaded: 0, totalBytes: 0, progressPercent: 0 });
    setErrorMsg('');

    try {
      const { downloadId } = await downloadApkWithProgress(
        updateInfo.apk,
        version,
        (p) => setDownloadProgress({ ...p })
      );
      // 下载完成 → 安装
      setStage(STAGE.INSTALLING);
      await installFromDownloadManager(downloadId);
      // 安装已触发（系统安装器接管），关闭弹窗
      setVisible(false);
    } catch (e) {
      const msg = e?.message || String(e);
      setErrorMsg(msg);
      setStage(STAGE.ERROR);
    }
  }

  // ─── 按钮操作 ───────────────────────────────────

  function handleLater() {
    setVisible(false);
  }

  async function handleSkip() {
    if (updateInfo?.remote?.version) {
      await setDismissedInfo(updateInfo.remote.version);
    }
    setVisible(false);
  }

  function handleFallbackBrowser() {
    // 兜底：跳转浏览器下载
    if (updateInfo?.apk?.url) {
      Linking.openURL(updateInfo.apk.url).catch(() => {
        const mirror = updateInfo.apk?.mirrors?.[0];
        if (mirror) Linking.openURL(mirror).catch(() => {});
      });
    } else {
      Linking.openURL('https://github.com/hzys7/lulu-ledger/releases');
    }
    setVisible(false);
  }

  function handleRetry() {
    startDownload();
  }

  function handlePermissionSettings() {
    openInstallSettings();
    // 用户从设置页回来后需要重新触发
    handleLater();
  }

  function handleClose() {
    setVisible(false);
  }

  // ─── 渲染 ───────────────────────────────────────

  if (!updateInfo) return null;

  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version || '???';

  const downloadPercent = downloadProgress.progressPercent > 0
    ? Math.round(downloadProgress.progressPercent)
    : 0;
  const downloadedStr = downloadProgress.totalBytes > 0
    ? formatBytes(downloadProgress.bytesDownloaded) + ' / ' + formatBytes(downloadProgress.totalBytes)
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: tc.surface }]}>

          {/* ─── 图标 ─────────────────────────────── */}
          <View style={[styles.iconWrap, { backgroundColor: tc.primarySubtle }]}>
            <Ionicons
              name={stage === STAGE.ERROR ? 'alert-circle' : 'arrow-up-circle'}
              size={28}
              color={stage === STAGE.ERROR ? tc.danger : tc.primary}
            />
          </View>

          {/* ─── 标题 ─────────────────────────────── */}
          <Text style={[styles.title, { color: tc.text }]}>
            {stage === STAGE.DOWNLOADING ? '正在下载更新' :
             stage === STAGE.INSTALLING ? '准备安装' :
             stage === STAGE.ERROR ? '下载失败' :
             stage === STAGE.NO_PERM ? '需要安装权限' :
             '发现新版本'}
          </Text>

          {/* ─── 版本号 ───────────────────────────── */}
          {stage === STAGE.INFO ? (
            <View style={styles.versionRow}>
              <Text style={[styles.versionOld, { color: tc.textMuted }]}>v{localVer}</Text>
              <Ionicons name="arrow-forward" size={14} color={tc.textMuted} />
              <Text style={[styles.versionNew, { color: tc.primary }]}>v{remoteVer}</Text>
            </View>
          ) : null}

          {/* ─── 下载进度条 ───────────────────────── */}
          {stage === STAGE.DOWNLOADING ? (
            <View style={styles.progressSection}>
              <View style={[styles.progressBarBg, { backgroundColor: tc.surfaceMuted }]}>
                <View style={[styles.progressBarFill, {
                  backgroundColor: tc.primary,
                  width: Math.max(downloadPercent, 2) + '%',
                }]} />
              </View>
              <View style={styles.progressTextRow}>
                <Text style={[styles.progressPercent, { color: tc.textSecondary }]}>
                  {downloadPercent}%
                </Text>
                {downloadedStr ? (
                  <Text style={[styles.progressBytes, { color: tc.textMuted }]}>
                    {downloadedStr}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.progressHint, { color: tc.textSubtle }]}>
                正在后台下载，请勿关闭 APP
              </Text>
            </View>
          ) : null}

          {/* ─── 安装中 ───────────────────────────── */}
          {stage === STAGE.INSTALLING ? (
            <View style={styles.installingSection}>
              <ActivityIndicator size="small" color={tc.primary} />
              <Text style={[styles.installingText, { color: tc.textSecondary }]}>
                正在调起系统安装程序...
              </Text>
            </View>
          ) : null}

          {/* ─── 错误信息 ─────────────────────────── */}
          {stage === STAGE.ERROR ? (
            <View style={[styles.errorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger + '22' }]}>
              <Text style={[styles.errorText, { color: tc.danger }]} numberOfLines={3}>
                {errorMsg || '未知错误'}
              </Text>
            </View>
          ) : null}

          {/* ─── 无权限 ───────────────────────────── */}
          {stage === STAGE.NO_PERM ? (
            <View style={styles.permSection}>
              <Text style={[styles.permText, { color: tc.textSecondary }]}>
                为了安装更新，需要授权「允许安装未知来源应用」。
              </Text>
            </View>
          ) : null}

          {/* ─── 更新内容（仅在 info 和 error 阶段显示） ──── */}
          {(stage === STAGE.INFO || stage === STAGE.ERROR) && updateInfo.remote?.body ? (
            <View style={[styles.notesBox, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
              <Text style={[styles.notesTitle, { color: tc.text }]}>更新内容</Text>
              <Text style={[styles.notesBody, { color: tc.textSecondary }]} numberOfLines={6}>
                {updateInfo.remote.body}
              </Text>
            </View>
          ) : null}

          {/* ─── 按钮区 ───────────────────────────── */}
          <View style={styles.btnRow}>
            {stage === STAGE.INFO ? (
              <>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleLater} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>稍后</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleSkip} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>忽略此版</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.4 }]} onPress={handleStartUpdate} activeOpacity={0.85}>
                  <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>立即更新</Text>
                </TouchableOpacity>
              </>
            ) : stage === STAGE.NO_PERM ? (
              <>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>稍后</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.4 }]} onPress={handlePermissionSettings} activeOpacity={0.85}>
                  <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>去授权</Text>
                </TouchableOpacity>
              </>
            ) : stage === STAGE.ERROR ? (
              <>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>稍后</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleFallbackBrowser} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>网页下载</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.4 }]} onPress={handleRetry} activeOpacity={0.85}>
                  <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>重试</Text>
                </TouchableOpacity>
              </>
            ) : stage === STAGE.DOWNLOADING ? (
              <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border, flex: 1 }]} onPress={handleClose} activeOpacity={0.7}>
                <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>后台下载</Text>
              </TouchableOpacity>
            ) : null}
          </View>

        </View>
      </View>
    </Modal>
  );
});

export default UpdatePrompt;

// ─── 样式 ──────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'stretch',
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl, fontWeight: fontWeight.semibold,
    letterSpacing: -0.3, textAlign: 'center', marginBottom: spacing.sm,
  },
  versionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginBottom: spacing.xs,
  },
  versionOld: { fontSize: fontSize.md, fontWeight: fontWeight.regular },
  versionNew: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  notesBox: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, marginBottom: spacing.base,
  },
  notesTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  notesBody: { fontSize: fontSize.sm, lineHeight: 19 },

  // 下载
  progressSection: { marginBottom: spacing.base },
  progressBarBg: {
    height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: 6, borderRadius: 3,
  },
  progressTextRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs,
  },
  progressPercent: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  progressBytes: { fontSize: fontSize.xs },
  progressHint: { fontSize: fontSize.xs, textAlign: 'center' },

  // 安装
  installingSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginBottom: spacing.base,
  },
  installingText: { fontSize: fontSize.sm },

  // 错误
  errorBox: {
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, marginBottom: spacing.base,
  },
  errorText: { fontSize: fontSize.sm, lineHeight: 20 },

  // 权限
  permSection: { marginBottom: spacing.base },
  permText: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },

  // 按钮
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: {},
  btnSecondary: { borderWidth: StyleSheet.hairlineWidth },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  btnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
});

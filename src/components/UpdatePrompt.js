// 璐璐记账 · 自动更新提示
// 下载：Android DownloadManager 系统服务
// 安装：系统 content:// URI

import { useSettings } from '../context/SettingsContext';
import { useThemeColors } from '../hooks/useThemeColors';
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';
import { formatBytes } from '../utils/updateDownloader';
import {
  LuluApkInstaller,
  openInstallSettings,
  installFromDownloadManager,
} from '../utils/updateInstaller';

const DISMISSED_KEY = 'lulu_update_dismissed';

let _ref = null;
let _lastCheck = { at: 0, status: 'never', current: '', latest: '', error: '' };
export function getLastUpdateCheck() { return { ..._lastCheck }; }
export function triggerUpdateCheck(force = true) {
  try { _ref?.checkNow(force); } catch (e) { console.warn('[UpdatePrompt] trigger failed:', e?.message || e); }
}

const UpdatePrompt = forwardRef(function UpdatePrompt(_props, ref) {
  const { settings } = useSettings();
  const tc = useThemeColors();

  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadId, setDownloadId] = useState(null);
  const [installError, setInstallError] = useState('');

  const flowActiveRef = useRef(false);
  const installingRef = useRef(false);
  const abortRef = useRef(null);
  const autoInstallTimerRef = useRef(null);

  useImperativeHandle(ref, () => {
    const api = { checkNow: (force = true) => runCheck({ force }) };
    _ref = api;
    return api;
  }, [settings?.autoCheckUpdate]);

  useEffect(() => {
    return () => {
      if (autoInstallTimerRef.current) {
        clearTimeout(autoInstallTimerRef.current);
        autoInstallTimerRef.current = null;
      }
      if (_ref) _ref = null;
    };
  }, []);

  function resetUpdateFlow() {
    if (autoInstallTimerRef.current) {
      clearTimeout(autoInstallTimerRef.current);
      autoInstallTimerRef.current = null;
    }
    flowActiveRef.current = false;
    installingRef.current = false;
    setStatus('idle');
    setProgress(0);
    setReceived(0);
    setTotal(0);
    setErrorMsg('');
    setInstallError('');
    setDownloadId(null);
    setUpdateInfo(null);
    setVisible(false);
  }

  async function runCheck({ force } = {}) {
    if (flowActiveRef.current) {
      if (!force) return;
      flowActiveRef.current = false;
    }
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
      resetUpdateFlow();
      setUpdateInfo(result);
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

  async function handleDownload() {
    if (!updateInfo?.apk) {
      Alert.alert('下载链接缺失', '请前往 GitHub 仓库手动下载。', [
        { text: '取消', style: 'cancel' },
        { text: '打开', onPress: () => Linking.openURL('https://github.com/hzys7/lulu-ledger/releases') },
      ]);
      return;
    }

    try {
      flowActiveRef.current = true;
      const apkName = updateInfo.apk.name;
      // 候选下载地址：主 URL + 镜像（国内用户无法直连 GitHub 时自动 fallback）
      const candidates = [updateInfo.apk.url, ...(updateInfo.apk.mirrors || [])];
      let lastError = '';

      // 遍历候选地址，逐个尝试直至成功
      for (let urlIdx = 0; urlIdx < candidates.length; urlIdx++) {
        // 用户可能在上一地址失败后、循环进入下一地址前点击了取消
        if (!flowActiveRef.current) return;

        const url = candidates[urlIdx];

        setStatus('downloading');
        setProgress(0);
        setReceived(0);
        setTotal(0);
        setErrorMsg('');
        setInstallError('');
        setDownloadId(null);

        const ac = new AbortController();
        abortRef.current = ac;

        // DownloadManager 下载到公共 Downloads/ 目录
        if (!LuluApkInstaller?.downloadApk) throw new Error('原生模块不可用');
        const dmId = await LuluApkInstaller.downloadApk(url, apkName);
        setDownloadId(dmId);

        // 轮询进度（最多 10 分钟/URL）
        for (let attempts = 0; attempts < 1200; attempts++) {
          if (ac.signal.aborted) {
            setStatus('idle'); setErrorMsg(''); abortRef.current = null; flowActiveRef.current = false;
            return;
          }
          await new Promise(r => setTimeout(r, 500));
          const prog = await LuluApkInstaller.getDownloadProgress(dmId);

          if (prog.status === 'SUCCESS') {
            setProgress(100);
            setReceived(prog.bytesDownloaded);
            setTotal(prog.totalBytes);
            setStatus('done');
            setErrorMsg('');
            abortRef.current = null;
            autoInstallTimerRef.current = setTimeout(() => {
              autoInstallTimerRef.current = null;
              if (!flowActiveRef.current) return;
              handleInstall(dmId);
            }, 800);
            return; // ✓ 下载成功
          } else if (prog.status === 'FAILED') {
            lastError = prog.reason || '下载失败';
            if (urlIdx < candidates.length - 1) {
              // 还有镜像地址没试，换下一个
              break; // 退出内层循环 → 外层 URL_LOOP 继续
            } else {
              throw new Error(lastError);
            }
          } else {
            setProgress(Math.round(prog.progressPercent));
            setReceived(prog.bytesDownloaded);
            setTotal(prog.totalBytes > 0 ? prog.totalBytes : total);
          }
        }
      }

      // 所有地址都试过了（含超时）
      throw new Error(lastError || '下载超时');
    } catch (e) {
      if (e?.name === 'AbortError') {
        setStatus('idle'); setErrorMsg(''); abortRef.current = null; flowActiveRef.current = false;
        return;
      }
      console.warn('[UpdatePrompt] download failed:', e?.message || e);
      setErrorMsg('下载失败：' + (e?.message || String(e)));
      setStatus('error');
      abortRef.current = null;
      flowActiveRef.current = false;
    }
  }

  async function handleInstall(dmId) {
    if (installingRef.current) return;
    installingRef.current = true;
    try {
      await installFromDownloadManager(dmId);
      flowActiveRef.current = false;
      installingRef.current = false;
      setStatus('installing');
    } catch (e) {
      console.warn('[UpdatePrompt] install failed:', e?.message || e);
      installingRef.current = false;
      flowActiveRef.current = false;
      setStatus('done');
      const errMsg = (e?.message || '未知错误').toLowerCase();
      if (errMsg.includes('permission') || errMsg.includes('权限')) {
        setInstallError('PERMISSION_DENIED');
      } else {
        setInstallError('安装失败：' + (e?.message || '未知错误') + '。请到系统下载文件夹中手动点击 APK 安装。');
      }
    }
  }

  function handleLater() {
    setVisible(false);
    resetUpdateFlow();
  }

  async function handleSkip() {
    if (updateInfo?.remote?.version) {
      await setDismissedInfo(updateInfo.remote.version);
    }
    setVisible(false);
    resetUpdateFlow();
  }

  // ─── UI ──────────────────────────────────────────────

  if (!updateInfo) return null;

  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version || '???';
  const fileSizeMB = (() => {
    if (!updateInfo.apk) return '?';
    const s = updateInfo.apk.size;
    return (!s || s <= 0) ? '未知' : (s / 1024 / 1024).toFixed(1);
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: tc.surface }]}>

          <View style={[styles.iconWrap, { backgroundColor: tc.primarySubtle }]}>
            <Ionicons name="arrow-up-circle" size={28} color={tc.primary} />
          </View>
          <Text style={[styles.title, { color: tc.text }]}>发现新版本</Text>
          <View style={styles.versionRow}>
            <Text style={[styles.versionOld, { color: tc.textMuted }]}>v{localVer}</Text>
            <Ionicons name="arrow-forward" size={14} color={tc.textMuted} />
            <Text style={[styles.versionNew, { color: tc.primary }]}>v{remoteVer}</Text>
          </View>
          <Text style={[styles.meta, { color: tc.textMuted }]}>约 {fileSizeMB} MB</Text>

          {updateInfo.remote?.body ? (
            <>
              <View style={[styles.notesBox, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <Text style={[styles.notesTitle, { color: tc.text }]}>更新内容</Text>
                <Text style={[styles.notesBody, { color: tc.textSecondary }]} numberOfLines={6}>
                  {updateInfo.remote.body}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.githubLink}
                onPress={() => Linking.openURL(updateInfo?.remote?.html_url || 'https://github.com/hzys7/lulu-ledger/releases')}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="open-outline" size={13} color={tc.primary} />
                <Text style={[styles.githubLinkText, { color: tc.primary }]}>打不开？去 GitHub 手动下载</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {status === 'downloading' ? (
            <View style={styles.progressBlock}>
              <View style={[styles.progressBg, { backgroundColor: tc.surfaceMuted }]}>
                <View style={[styles.progressFill, { backgroundColor: tc.primary, width: progress >= 0 ? `${Math.min(progress, 100)}%` : '30%' }]} />
              </View>
              <View style={styles.progressInfoRow}>
                <Text style={[styles.progressText, { color: tc.textMuted }]}>
                  {progress >= 0 ? `${Math.round(progress)}%` : '下载中…'}
                </Text>
                <Text style={[styles.progressMeta, { color: tc.textMuted }]}>
                  {formatBytes(received)}{total > 0 ? ` / ${formatBytes(total)}` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {status === 'error' ? (
            <>
              <Text style={[styles.errorText, { color: tc.danger }]}>{errorMsg}</Text>
              <TouchableOpacity
                style={[styles.githubLink, styles.githubLinkProminent]}
                onPress={() => Linking.openURL(updateInfo?.remote?.html_url || 'https://github.com/hzys7/lulu-ledger/releases')}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={14} color={tc.primary} />
                <Text style={[styles.githubLinkText, { color: tc.primary, fontWeight: fontWeight.semibold }]}>
                  打开 GitHub 页面手动下载
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {status === 'done' && installError ? (
            <View style={[styles.installErrorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger }]}>
              {installError === 'PERMISSION_DENIED' ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                    <Ionicons name="alert-circle" size={14} color={tc.danger} />
                    <Text style={[styles.installErrorText, { color: tc.danger }]}>安装需要授权</Text>
                  </View>
                  <Text style={[styles.installErrorHint, { color: tc.textMuted }]}>
                    请在系统设置中开启「安装未知应用」权限，然后重试。
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.retryBtn, { borderColor: tc.border }]}
                      onPress={() => { setInstallError(''); setStatus('done'); handleInstall(downloadId); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.retryBtnText, { color: tc.textSecondary }]}>重试安装</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.retryBtn, { borderColor: tc.border }]}
                      onPress={openInstallSettings}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.retryBtnText, { color: tc.primary }]}>去设置</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.retryBtn, { borderColor: tc.border }]}
                      onPress={() => { setVisible(false); resetUpdateFlow(); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.retryBtnText, { color: tc.textMuted }]}>关闭</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                  <Ionicons name="alert-circle" size={14} color={tc.danger} />
                  <Text style={[styles.installErrorText, { color: tc.danger }]}>{installError}</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.btnRow}>
            {status === 'idle' || status === 'error' ? (
              <>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleLater} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>稍后</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleSkip} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>忽略此版</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.4 }]} onPress={handleDownload} activeOpacity={0.85}>
                  <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>立即更新</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {status === 'downloading' ? (
              <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border, flex: 1 }]} onPress={() => {
                if (autoInstallTimerRef.current) {
                  clearTimeout(autoInstallTimerRef.current);
                  autoInstallTimerRef.current = null;
                }
                try { abortRef.current?.abort?.(); } catch {}
                flowActiveRef.current = false;
                setStatus('idle');
              }} activeOpacity={0.7}>
                <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>取消下载</Text>
              </TouchableOpacity>
            ) : null}
            {status === 'done' && !installError ? (
              <TouchableOpacity
                style={[styles.githubLink, styles.githubLinkProminent]}
                onPress={() => handleInstall(downloadId)}
                activeOpacity={0.7}
              >
                <Ionicons name="download" size={14} color={tc.primary} />
                <Text style={[styles.githubLinkText, { color: tc.primary, fontWeight: fontWeight.semibold }]}>
                  点击安装
                </Text>
              </TouchableOpacity>
            ) : null}
            {status === 'installing' ? (
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1 }]} onPress={handleLater} activeOpacity={0.85}>
                <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>完成</Text>
              </TouchableOpacity>
            ) : null}
          </View>

        </View>
      </View>
    </Modal>
  );
});

export default UpdatePrompt;

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
  meta: { fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.base },
  notesBox: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, marginBottom: spacing.base,
  },
  notesTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  notesBody: { fontSize: fontSize.sm, lineHeight: 19 },
  progressBlock: { marginBottom: spacing.base },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.xs },
  progressFill: { height: '100%', borderRadius: 3 },
  progressInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressText: { fontSize: fontSize.xs, textAlign: 'center' },
  progressMeta: { fontSize: fontSize.xs, fontVariant: ['tabular-nums'] },
  errorText: { fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.base },
  installErrorBox: {
    padding: spacing.sm, borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.base, gap: 6,
  },
  installErrorText: { fontSize: fontSize.xs, flex: 1, lineHeight: 17 },
  installErrorHint: { fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
  retryBtn: { flex: 1, height: 34, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm },
  retryBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: {},
  btnSecondary: { borderWidth: StyleSheet.hairlineWidth },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  btnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  githubLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.xs },
  githubLinkProminent: { paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'center' },
  githubLinkText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, letterSpacing: 0.1 },
});

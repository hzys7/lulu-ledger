// 璐璐记账 · 自动更新提示
// 下载：Android DownloadManager（首选）→ expo-file-system（回退）
// 安装：系统 content:// URI → 多种方法回退
// 兜底：手动粘贴 GitHub URL

import { useSettings } from '../context/SettingsContext';
import { useThemeColors } from '../hooks/useThemeColors';
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  AppState,
  Linking,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion, getLastSourceErrors, compareVersion } from '../utils/updateChecker';
import { formatBytes, buildCandidateUrls, isDownloadManagerAvailable } from '../utils/updateDownloader';
import {
  LuluApkInstaller,
  getDownloadManagerUri,
  checkInstallPermission,
  openInstallSettings,
  openApkInFileManager,
  installFromDownloadManager,
  installFromFileProvider,
  installWithIntentLauncher,
  installWithShareAsync,
  fileUriToContentUri,
  verifyApkIntegrity,
} from '../utils/updateInstaller';
import { downloadApk as dmDownloadApk, getDownloadProgress as dmGetProgress } from '../../modules/lulu-apk-installer/src/index';

const DISMISSED_KEY = 'lulu_update_dismissed';

// 模块级 ref singleton — 任何组件（包括设置页）都能触发立即检查
let _ref = null;
// 模块级状态 — 设置页能读到
let _lastCheck = { at: 0, status: 'never', current: '', latest: '', error: '' };
export function getLastUpdateCheck() { return { ..._lastCheck }; }
export function triggerUpdateCheck(force = true) {
  try { _ref?.checkNow(force); } catch (e) { console.warn('[UpdatePrompt] trigger failed:', e?.message || e); }
}

// ─── 从 GitHub Release URL 手动解析版本号 ──────────────
function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') return null;
  // 匹配 https://github.com/hzys7/lulu-ledger/releases/tag/v1.2.86
  const m = url.match(/\/releases\/tag\/v?(\d+\.\d+\.\d+)/i);
  if (m) return m[1];
  // 匹配 release 页面中的版本文本
  const m2 = url.match(/v?(\d+\.\d+\.\d+)/);
  if (m2) return m2[1];
  return null;
}

const UpdatePrompt = forwardRef(function UpdatePrompt(_props, ref) {
  const { settings } = useSettings();
  const tc = useThemeColors();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error | install-fail
  const [progress, setProgress] = useState(0);
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadId, setDownloadId] = useState(null);       // DownloadManager ID
  const [localFile, setLocalFile] = useState(null);         // expo-file-system File object
  const [installError, setInstallError] = useState('');
  const [showInstallError, setShowInstallError] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const flowActiveRef = useRef(false);
  const installingRef = useRef(false);
  const abortRef = useRef(null);
  const autoInstallTimerRef = useRef(null);

  useImperativeHandle(ref, () => {
    const api = {
      checkNow: (force = true) => runCheck({ force }),
    };
    _ref = api;
    return api;
  }, [settings?.autoCheckUpdate]);

  // Unregister on unmount
  useEffect(() => {
    return () => { if (_ref) _ref = null; };
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
    setShowInstallError(false);
    setDownloadId(null);
    setLocalFile(null);
    setUpdateInfo(null);
    setVisible(false);
    setShowManualInput(false);
    setManualUrl('');
  }

  // ─── 版本检查 ───────────────────────────────────────

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
        const errors = result?.errors || getLastSourceErrors();
        const detail = errors.length > 0 ? errors.join('; ') : '网络请求失败';
        _lastCheck = { at: Date.now(), status: 'error', current: getLocalVersion(), latest: '', error: detail };
        DeviceEventEmitter.emit('lulu:update-check-result', { status: 'error', error: detail, current: getLocalVersion() });
        // 显示手动输入 URL 兜底
        resetUpdateFlow();
        setUpdateInfo({ _manual: true, local: getLocalVersion() });
        setShowManualInput(true);
        setVisible(true);
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

  // ─── 手动 URL 输入 ──────────────────────────────────

  async function handleManualSubmit() {
    const version = parseGitHubUrl(manualUrl);
    if (!version) {
      Alert.alert('无法识别', '请输入正确的 GitHub Release 页面链接\n例如：\nhttps://github.com/hzys7/lulu-ledger/releases/tag/v1.2.86');
      return;
    }
    const local = getLocalVersion();
    const cmp = compareVersion(version, local);
    if (cmp <= 0) {
      Alert.alert('无需更新', `当前版本 v${local}，手动输入的版本 v${version} 并不更新。`);
      return;
    }
    // 构造 APK URL
    const apkName = `lulu-ledger-${version}-arm64.apk`;
    const apkUrl = `https://github.com/hzys7/lulu-ledger/releases/download/v${version}/${apkName}`;
    setUpdateInfo({
      hasUpdate: true,
      local,
      remote: { version, name: 'v' + version },
      apk: { name: apkName, url: apkUrl, size: 0, mirrors: [] },
    });
    setShowManualInput(false);
    setErrorMsg('');
  }

  // ─── 下载 ────────────────────────────────────────────

  async function handleDownload() {
    if (!updateInfo?.apk) {
      Alert.alert('下载链接缺失', '请前往 GitHub 仓库手动下载。', [
        { text: '取消', style: 'cancel' },
        { text: '打开', onPress: () => Linking.openURL('https://github.com/hzys7/lulu-ledger/releases') },
      ]);
      return;
    }

    // --- 检查安装权限 ---
    if (Platform.OS === 'android') {
      const hasPermission = await checkInstallPermission();
      if (!hasPermission) {
        let directGranted = false;
        if (LuluApkInstaller && typeof LuluApkInstaller.requestInstallPermission === 'function') {
          try {
            let resolved = false;
            const result = await Promise.race([
              LuluApkInstaller.requestInstallPermission().then(r => {
                resolved = true;
                return r;
              }),
              new Promise((resolve) => {
                const sub = AppState.addEventListener('change', async (state) => {
                  if (state === 'active' && !resolved) {
                    resolved = true;
                    sub.remove();
                    await new Promise(r => setTimeout(r, 300));
                    const granted = await checkInstallPermission();
                    resolve(granted);
                  }
                });
                setTimeout(async () => {
                  if (!resolved) {
                    resolved = true;
                    sub.remove();
                    const granted = await checkInstallPermission();
                    resolve(granted);
                  }
                }, 15000);
              }),
            ]);
            directGranted = !!result;
          } catch (e) {
            console.warn('[UpdatePrompt] direct permission request failed:', e?.message || e);
          }
        }
        if (!directGranted) {
          Alert.alert(
            '需要安装权限',
            '下载前需要先授权「璐璐记账」安装APK。\n\n请点击「去设置」，然后在「安装未知应用」页面中打开「允许来自此来源」开关。',
            [
              { text: '取消', style: 'cancel' },
              { text: '去设置', onPress: openInstallSettings },
            ]
          );
          return;
        }
      }
    }

    try {
      flowActiveRef.current = true;
      setStatus('downloading');
      setProgress(0);
      setReceived(0);
      setTotal(0);
      setErrorMsg('');
      setInstallError('');
      setShowInstallError(false);
      setDownloadId(null);
      setLocalFile(null);

      const ac = new AbortController();
      abortRef.current = ac;
      const apkName = updateInfo.apk.name;
      const candidates = buildCandidateUrls(updateInfo, settings?.useProxy);
      const primaryUrl = candidates[0] || updateInfo.apk.url;

      // Method 1 (首选): DownloadManager — 下载到公共 Downloads/
      if (Platform.OS === 'android' && isDownloadManagerAvailable()) {
        try {
          const dmId = await dmDownloadApk(primaryUrl, apkName);
          setDownloadId(dmId);

          // 轮询进度
          let lastErr = null;
          for (let attempts = 0; attempts < 300; attempts++) {
            if (ac.signal.aborted) {
              setStatus('idle');
              setErrorMsg('');
              abortRef.current = null;
              flowActiveRef.current = false;
              return;
            }
            await new Promise(r => setTimeout(r, 500));
            const prog = await dmGetProgress(dmId);

            if (prog.status === 'SUCCESS') {
              setProgress(100);
              setReceived(prog.bytesDownloaded);
              setTotal(prog.totalBytes);
              setStatus('done');
              setErrorMsg('');
              abortRef.current = null;
              autoInstallTimerRef.current = setTimeout(() => {
                autoInstallTimerRef.current = null;
                handleInstallFromDM(dmId);
              }, 800);
              return;
            } else if (prog.status === 'FAILED') {
              lastErr = new Error(prog.reason || 'DownloadManager 下载失败');
              break;
            } else {
              setProgress(Math.round(prog.progressPercent));
              setReceived(prog.bytesDownloaded);
              setTotal(prog.totalBytes > 0 ? prog.totalBytes : total);
            }
          }
          if (lastErr) throw lastErr;
        } catch (dmErr) {
          if (dmErr?.name === 'AbortError') {
            setStatus('idle');
            setErrorMsg('');
            abortRef.current = null;
            flowActiveRef.current = false;
            return;
          }
          console.warn('[UpdatePrompt] DownloadManager failed, using expo-file-system fallback:', dmErr?.message || dmErr);
        }
      }

      // Method 2 (回退): expo-file-system 下载到缓存目录
      setErrorMsg('正在通过备用方式下载…');
      const { File: FSFile, Paths: FSPaths } = require('expo-file-system');
      const dest = new FSFile(FSPaths.cache, apkName);
      const { tryDownloadOne } = require('../utils/updateDownloader');
      const file = await tryDownloadOne(primaryUrl, dest, ac.signal, {
        onProgress: ({ bytesWritten, totalBytes: tb, progress: pct }) => {
          setReceived(bytesWritten);
          if (tb > 0) { setTotal(tb); setProgress(pct); }
        },
        onSpeed: () => {},
      });
      setLocalFile(file);
      setStatus('done');
      setErrorMsg('');
      abortRef.current = null;
      autoInstallTimerRef.current = setTimeout(() => {
        autoInstallTimerRef.current = null;
        handleInstallFromFS(file.uri || file.path);
      }, 800);
    } catch (e) {
      if (e?.name === 'AbortError') {
        setStatus('idle');
        setErrorMsg('');
        abortRef.current = null;
        flowActiveRef.current = false;
        return;
      }
      console.warn('[UpdatePrompt] download failed:', e?.message || e);
      setErrorMsg('下载失败：' + (e?.message || String(e)) + '。可稍后重试，或前往 GitHub 手动下载。');
      setStatus('error');
      abortRef.current = null;
      flowActiveRef.current = false;
    }
  }

  // ─── 从 DownloadManager 安装 ─────────────────────────

  async function handleInstallFromDM(downloadId) {
    if (installingRef.current) return;
    installingRef.current = true;
    try {
      // Method 1: DownloadManager content:// URI（系统级，最可靠）
      await installFromDownloadManager(downloadId);
      flowActiveRef.current = false;
      installingRef.current = false;
      setStatus('installing');
      return;
    } catch (e1) {
      console.warn('[UpdatePrompt] DownloadManager install failed:', e1?.message || e1);
    }

    // Method 2: 获取 content:// URI → IntentLauncher
    try {
      const uri = await getDownloadManagerUri(downloadId);
      await installWithIntentLauncher(uri);
      flowActiveRef.current = false;
      installingRef.current = false;
      setStatus('installing');
      return;
    } catch (e2) {
      console.warn('[UpdatePrompt] IntentLauncher install failed:', e2?.message || e2);
    }

    // Method 3: expo-sharing
    try {
      const uri = await getDownloadManagerUri(downloadId);
      await installWithShareAsync(uri);
      flowActiveRef.current = false;
      installingRef.current = false;
      setStatus('installing');
      return;
    } catch (e3) {
      console.warn('[UpdatePrompt] expo-sharing install failed:', e3?.message || e3);
    }

    // Method 4: 直接打开 URI
    try {
      const uri = await getDownloadManagerUri(downloadId);
      await Linking.openURL(uri);
      flowActiveRef.current = false;
      installingRef.current = false;
      setStatus('installing');
      return;
    } catch (e4) {
      console.warn('[UpdatePrompt] Linking.openURL failed:', e4?.message || e4);
    }

    installFailed('DownloadManager 安装失败');
  }

  // ─── 从 expo-file-system 文件安装 ───────────────────

  async function handleInstallFromFS(fileUri) {
    if (!fileUri) return installFailed('文件路径为空');
    if (installingRef.current) return;
    installingRef.current = true;
    try {
      const filePath = fileUri.replace(/^file:\/\//, '');
      const check = await verifyApkIntegrity(filePath);
      if (!check.ok) {
        throw new Error('APK 验证失败：' + check.reason);
      }
      let contentUri = fileUri;
      if (fileUri.startsWith('file://')) {
        const mapped = fileUriToContentUri(fileUri);
        if (!mapped) throw new Error('无法生成文件访问 URI');
        contentUri = mapped;
      }
      // Method 1: 原生模块
      if (LuluApkInstaller && typeof LuluApkInstaller.installApk === 'function') {
        try {
          await installFromFileProvider(contentUri);
          flowActiveRef.current = false;
          installingRef.current = false;
          setStatus('installing');
          return;
        } catch (e1) { console.warn('[UpdatePrompt] native install failed:', e1?.message || e1); }
      }
      // Method 2: IntentLauncher
      try {
        await installWithIntentLauncher(contentUri);
        flowActiveRef.current = false;
        installingRef.current = false;
        setStatus('installing');
        return;
      } catch (e2) { console.warn('[UpdatePrompt] IntentLauncher failed:', e2?.message || e2); }
      // Method 3: expo-sharing
      try {
        await installWithShareAsync(contentUri);
        flowActiveRef.current = false;
        installingRef.current = false;
        setStatus('installing');
        return;
      } catch (e3) { console.warn('[UpdatePrompt] shareAsync failed:', e3?.message || e3); }
      // Method 4: Linking
      try {
        await Linking.openURL(contentUri);
        flowActiveRef.current = false;
        installingRef.current = false;
        setStatus('installing');
        return;
      } catch (e4) { console.warn('[UpdatePrompt] Linking failed:', e4?.message || e4); }

      throw new Error('所有安装方法均失败');
    } catch (e) {
      installFailed(e?.message || String(e), fileUri);
    }
  }

  function installFailed(msg, filePath) {
    console.warn('[UpdatePrompt] install failed:', msg);
    installingRef.current = false;
    flowActiveRef.current = false;
    setStatus('done');
    setInstallError(msg);
    setShowInstallError(true);
  }

  // ─── 其他操作 ────────────────────────────────────────

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

  // ─── UI ──────────────────────────────────────────────

  if (!updateInfo) return null;

  const isManualMode = updateInfo._manual;
  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version || '???';
  const fileSizeMB = (() => {
    if (!updateInfo.apk) return '?';
    const s = updateInfo.apk.size;
    return (!s || s <= 0) ? '未知' : (s / 1024 / 1024).toFixed(1);
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: tc.surface }]}>

          {/* ── 手动输入模式 ── */}
          {isManualMode ? (
            <>
              <View style={[styles.iconWrap, { backgroundColor: tc.warningSubtle || '#FFF3CD' }]}>
                <Ionicons name="link" size={28} color={tc.warning || '#F59E0B'} />
              </View>
              <Text style={[styles.title, { color: tc.text }]}>自动检测失败</Text>
              <Text style={[styles.manualHint, { color: tc.textSecondary }]}>
                所有网络源均无法连接到 GitHub。{'\n'}
                请复制 GitHub Releases 页面链接粘贴到下方：
              </Text>
              <TextInput
                style={[styles.urlInput, { backgroundColor: tc.surfaceMuted, borderColor: tc.border, color: tc.text }]}
                placeholder="https://github.com/hzys7/lulu-ledger/releases/tag/v1.2.XX"
                placeholderTextColor={tc.textMuted}
                value={manualUrl}
                onChangeText={setManualUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleLater} activeOpacity={0.7}>
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.5 }]} onPress={handleManualSubmit} activeOpacity={0.85}>
                  <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>确认</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* ── 更新信息 ── */}
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

              {/* ── 下载进度 ── */}
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

              {/* ── 错误 ── */}
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

              {/* ── 下载完成 → 安装 ── */}
              {status === 'done' ? (
                <View style={styles.doneBlock}>
                  <Text style={[styles.doneText, { color: tc.success }]}>✅ 下载完成</Text>
                  <Text style={[styles.doneSubText, { color: tc.textMuted }]}>正在启动安装…</Text>
                  {(installError || showInstallError) ? (
                    <View style={[styles.installErrorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                        <Ionicons name="alert-circle" size={14} color={tc.danger} />
                        <Text style={[styles.installErrorText, { color: tc.danger }]}>
                          安装失败：{installError || '未知错误'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={[styles.settingsLinkBtn, { backgroundColor: tc.primary }]}
                          onPress={() => {
                            if (downloadId != null) handleInstallFromDM(downloadId);
                            else if (localFile) handleInstallFromFS(localFile.uri || localFile.path);
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="refresh" size={13} color="#fff" />
                          <Text style={styles.settingsLinkText}>重试</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.settingsLinkBtn, { backgroundColor: tc.danger }]}
                          onPress={openInstallSettings}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="settings-outline" size={13} color="#fff" />
                          <Text style={styles.settingsLinkText}>去设置</Text>
                        </TouchableOpacity>
                        {localFile ? (
                          <TouchableOpacity
                            style={[styles.settingsLinkBtn, { backgroundColor: tc.textSecondary }]}
                            onPress={() => openApkInFileManager(localFile.uri || localFile.path)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="folder-open-outline" size={13} color="#fff" />
                            <Text style={styles.settingsLinkText}>手动安装</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.settingsLinkBtn, { backgroundColor: tc.textSecondary }]}
                            onPress={() => {
                              Linking.openURL('https://github.com/hzys7/lulu-ledger/releases');
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="open-outline" size={13} color="#fff" />
                            <Text style={styles.settingsLinkText}>前往 GitHub</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* ── 按钮行 ── */}
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
                    try { abortRef.current?.abort?.(); } catch {}
                    setStatus('idle');
                  }} activeOpacity={0.7}>
                    <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>取消下载</Text>
                  </TouchableOpacity>
                ) : null}
                {status === 'done' && !showInstallError ? (
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1 }]} onPress={() => {
                    if (downloadId != null) handleInstallFromDM(downloadId);
                    else if (localFile) handleInstallFromFS(localFile.uri || localFile.path);
                  }} activeOpacity={0.85}>
                    <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>点击安装</Text>
                  </TouchableOpacity>
                ) : null}
                {status === 'installing' ? (
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1 }]} onPress={handleLater} activeOpacity={0.85}>
                    <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>完成</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}

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
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'stretch',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  manualHint: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.base,
  },
  urlInput: {
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    marginBottom: spacing.base,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  versionOld: { fontSize: fontSize.md, fontWeight: fontWeight.regular },
  versionNew: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  notesBox: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  notesTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  notesBody: {
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  progressBlock: { marginBottom: spacing.base },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressText: { fontSize: fontSize.xs, textAlign: 'center' },
  progressMeta: { fontSize: fontSize.xs, fontVariant: ['tabular-nums'] },
  errorText: { fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.base },
  doneBlock: { marginBottom: spacing.base },
  doneText: { fontSize: fontSize.md, textAlign: 'center', fontWeight: fontWeight.semibold },
  doneSubText: { fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.base, marginTop: spacing.xs, fontWeight: fontWeight.medium },
  installErrorBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    gap: 6,
  },
  installErrorText: { fontSize: fontSize.xs, flex: 1, lineHeight: 17 },
  settingsLinkBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: borderRadius.sm, marginTop: 4 },
  settingsLinkText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
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

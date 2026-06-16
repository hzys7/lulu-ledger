// 璐璐记账 · 自动更新提示
// App 启动时检查 GitHub Releases，发现新版本弹窗让用户点下载
import { useSettings } from '../context/SettingsContext';
import { useThemeColors } from '../hooks/useThemeColors';
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';
import { formatBytes, buildCandidateUrls, tryDownloadOne, rankBySpeed } from '../utils/updateDownloader';
import {
  LuluApkInstaller,
  checkInstallPermission,
  openInstallSettings,
  fileUriToContentUri,
  verifyApkIntegrity,
} from '../utils/updateInstaller';

const DISMISSED_KEY = 'lulu_update_dismissed';

// 模块级 ref singleton — 任何组件（包括设置页）都能触发立即检查
let _ref = null;
// 模块级状态 — 设置页能读到
let _lastCheck = { at: 0, status: 'never', current: '', latest: '', error: '' };
export function getLastUpdateCheck() { return { ..._lastCheck }; }
export function triggerUpdateCheck(force = true) {
  try { _ref?.checkNow(force); } catch (e) { console.warn('[UpdatePrompt] trigger failed:', e?.message || e); }
}

const UpdatePrompt = forwardRef(function UpdatePrompt(_props, ref) {
  const { settings } = useSettings();
  const tc = useThemeColors();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [localFile, setLocalFile] = useState(null);
  const [installError, setInstallError] = useState('');
  const [showInstallError, setShowInstallError] = useState(false);
  const downloadTaskRef = useRef(null);
  const abortRef = useRef(null);
  const installingRef = useRef(false);
  const lastProgressAtRef = useRef(0);
  const lastBytesRef = useRef(0);
  const currentSourceRef = useRef('');
  const autoInstallTimerRef = useRef(null);
  const flowActiveRef = useRef(false);

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
    setSpeed(0);
    setReceived(0);
    setTotal(0);
    setStartTime(0);
    lastBytesRef.current = 0;
    setErrorMsg('');
    setInstallError('');
    setShowInstallError(false);
    setLocalFile(null);
    setUpdateInfo(null);
    setVisible(false);
  }

  async function runCheck({ force } = {}) {
    if (flowActiveRef.current) {
      if (!force) return;
      console.warn('[UpdatePrompt] force-checking while a previous flow is in flight; clearing flowActiveRef');
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
      if (!raw) return null;
      return JSON.parse(raw);
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

    // --- Step 0: Check install permission BEFORE downloading ---
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
      setInstallError('');
      setShowInstallError(false);
      setSpeed(0);
      setReceived(0);
      setTotal(0);
      setStartTime(0);
      lastBytesRef.current = 0;
      setErrorMsg('');
      const ac = new AbortController();
      abortRef.current = ac;
      const apkName = `update-${updateInfo.apk.name}`;
      const dest = new File(Paths.cache, apkName);
      const candidates = await rankBySpeed(
        buildCandidateUrls(updateInfo, settings?.useProxy),
        ac.signal,
        (msg) => setErrorMsg(msg)
      );
      let lastErr = null;

      for (let i = 0; i < candidates.length; i++) {
        const url = candidates[i];
        if (candidates.length > 1) {
          let host = '源';
          try { host = new URL(url).hostname; } catch {}
          currentSourceRef.current = host;
          setErrorMsg(`正在尝试第 ${i + 1} / ${candidates.length} 个下载源（${host}）…`);
        }
        try {
          const file = await tryDownloadOne(url, dest, ac.signal, {
            onProgress: ({ bytesWritten, totalBytes, progress: pct }) => {
              lastProgressAtRef.current = Date.now();
              setReceived(bytesWritten);
              if (totalBytes > 0) {
                setTotal(totalBytes);
                setProgress(pct);
              } else if (bytesWritten > 0) {
                setProgress((prev) => (prev < 0 ? prev : -1));
              }
            },
            onSpeed: (kbps) => setSpeed(kbps),
          });
          setLocalFile(file);
          setStatus('done');
          setErrorMsg('');
          abortRef.current = null;
          autoInstallTimerRef.current = setTimeout(() => {
            autoInstallTimerRef.current = null;
            handleInstall(file.uri || file.path);
          }, 500);
          return;
        } catch (e) {
          if (e?.name === 'AbortError') {
            setStatus('idle');
            setErrorMsg('');
            setProgress(0);
            abortRef.current = null;
            return;
          }
          lastErr = e;
          let host = '未知';
          try { host = new URL(url).hostname; } catch {}
          console.warn(`[UpdatePrompt] source ${host} failed:`, e?.message || e);
          const elapsed = lastProgressAtRef.current ? Date.now() - lastProgressAtRef.current : 0;
          setErrorMsg(elapsed >= 30000
            ? `${host} 太慢（${Math.round(elapsed / 1000)}s 无响应），跳过…`
            : `${host} 失败：${e?.message || '未知错误'}`
          );
          try { await dest.delete(); } catch {}
        }
      }
      throw lastErr || new Error('所有下载源均失败');
    } catch (e) {
      console.warn('[UpdatePrompt] download failed (outer):', e?.message || e);
      setErrorMsg('下载失败：' + (e?.message || String(e)) + '。可稍后重试，或前往 GitHub 手动下载。');
      setStatus('error');
      abortRef.current = null;
      flowActiveRef.current = false;
    }
  }

  async function handleInstall(uri) {
    if (!uri) return;
    if (installingRef.current) return;
    installingRef.current = true;
    try {
      const filePath = uri.replace(/^file:\/\//, '');
      const check = await verifyApkIntegrity(filePath);
      if (!check.ok) {
        throw new Error('APK 验证失败：' + check.reason + '。请重新下载。');
      }
      let contentUri = uri;
      if (uri.startsWith('file://')) {
        const mapped = fileUriToContentUri(uri);
        if (!mapped) {
          throw new Error('无法生成文件访问 URI（不在缓存目录中）');
        }
        contentUri = mapped;
      }
      // Method 1: Custom native module
      if (LuluApkInstaller && typeof LuluApkInstaller.installApk === 'function') {
        try {
          await LuluApkInstaller.installApk(contentUri);
          flowActiveRef.current = false;
          installingRef.current = false;
          setStatus('installing');
          return;
        } catch (e1) {
          console.warn('[UpdatePrompt] native module install failed:', e1?.message || e1);
        }
      }
      // Method 2: expo-sharing (fallback)
      try {
        const { shareAsync } = await import('expo-sharing');
        await shareAsync(contentUri, {
          mimeType: 'application/vnd.android.package-archive',
          dialogTitle: '安装璐璐记账更新',
        });
        flowActiveRef.current = false;
        installingRef.current = false;
        setStatus('installing');
        return;
      } catch (e2) {
        console.warn('[UpdatePrompt] expo-sharing failed:', e2?.message || e2);
      }
      // Method 3: Linking.openURL (last resort)
      try {
        await Linking.openURL(contentUri);
        flowActiveRef.current = false;
        installingRef.current = false;
        setStatus('installing');
        return;
      } catch (e3) {
        console.warn('[UpdatePrompt] Linking.openURL failed:', e3?.message || e3);
      }
      throw new Error('系统无法自动安装 APK。\n\n请尝试用文件管理器打开：' + filePath);
    } catch (e) {
      const msg = e?.message || String(e);
      console.warn('[UpdatePrompt] install failed:', msg);
      installingRef.current = false;
      flowActiveRef.current = false;
      setStatus('done');
      setInstallError(msg);
      setShowInstallError(true);
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

  if (!updateInfo) return null;

  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version;
  const fileSizeMB = (() => {
    if (!updateInfo.apk) return '?';
    const s = updateInfo.apk.size;
    if (!s || s <= 0) return '未知';
    return (s / 1024 / 1024).toFixed(1);
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
                <View style={[styles.progressFill, { backgroundColor: tc.primary, width: progress >= 0 ? `${progress}%` : '30%' }]} />
              </View>
              <View style={styles.progressInfoRow}>
                <Text style={[styles.progressText, { color: tc.textMuted }]}>
                  {progress >= 0 ? `${progress}%` : '下载中…'}
                </Text>
                <Text style={[styles.progressMeta, { color: tc.textMuted }]}>
                  {formatBytes(received)}{total > 0 ? ` / ${formatBytes(total)}` : ''}{speed > 0 ? ` · ${speed} KB/s` : ''}
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
                  <TouchableOpacity
                    style={[styles.settingsLinkBtn, { backgroundColor: tc.danger }]}
                    onPress={openInstallSettings}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="settings-outline" size={13} color="#fff" />
                    <Text style={styles.settingsLinkText}>去设置</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
                try { abortRef.current?.abort?.(); } catch {}
                try { downloadTaskRef.current?.cancel?.(); } catch {}
                setStatus('idle');
              }} activeOpacity={0.7}>
                <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>取消下载</Text>
              </TouchableOpacity>
            ) : null}
            {status === 'done' && localFile ? (
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1 }]} onPress={() => handleInstall(localFile.uri || localFile.path)} activeOpacity={0.85}>
                <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>点击安装</Text>
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

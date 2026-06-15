// 璐璐记账 · 自动更新提示
// App 启动时检查 GitHub Releases，发现新版本弹窗让用户点下载
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { AppState } from 'react-native';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  DeviceEventEmitter,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Application from 'expo-application';
import { useFinance } from '../context/FinanceContext';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

const DISMISSED_KEY = 'lulu_update_dismissed';
// 距离上次检查 < 30 分钟就不再查，避免切 tab 时反复请求
// 模块级 ref singleton — 任何组件（包括设置页）都能触发立即检查
let _ref = null;
// 模块级状态 — 设置页能读到
let _lastCheck = { at: 0, status: 'never', current: '', latest: '', error: '' };
export function getLastUpdateCheck() { return { ..._lastCheck }; }
export function triggerUpdateCheck(force = true) {
  try { _ref?.checkNow(force); } catch (e) { console.warn('[UpdatePrompt] trigger failed:', e?.message || e); }
}

const UpdatePrompt = forwardRef(function UpdatePrompt(_props, ref) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
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
  // Reentrancy guard: handleInstall may be called both automatically
  // 300ms after download completes and again when the user taps
  // the install button. expo-intent-launcher rejects the second call
  // with 'IntentLauncher activity is already started'.
  const installingRef = useRef(false);
  const lastProgressAtRef = useRef(0);
  const currentSourceRef = useRef("");
  // Track the post-download auto-install setTimeout so we can cancel it
  // if the user dismisses the modal (otherwise it fires into a closed
  // modal and leaves installingRef=true forever).
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

  // Reset all per-check state. Called whenever a new update flow begins
  // (or the modal is dismissed) so we never get stuck in 'installing'
  // or 'done' from a previous round.
  function resetUpdateFlow() {
    if (autoInstallTimerRef.current) {
      clearTimeout(autoInstallTimerRef.current);
      autoInstallTimerRef.current = null;
    }
    installingRef.current = false;
    setStatus('idle');
    setProgress(0);
    setSpeed(0);
    setReceived(0);
    setTotal(0);
    setStartTime(0);
    setErrorMsg('');
    setInstallError('');
    setShowInstallError(false);
    setLocalFile(null);
  }

  async function runCheck({ force } = {}) {
    // 设置里关了就不查（force=true 时也尊重显式触发）
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
        DeviceEventEmitter.emit('lulu:update-check-result', { status: 'error', error: '网络请求失败' });
        return;
      }
      if (!result.hasUpdate) {
        _lastCheck = { at: Date.now(), status: 'up-to-date', current: getLocalVersion(), latest: result.remote.version, error: '' };
        DeviceEventEmitter.emit('lulu:update-check-result', {
          status: 'up-to-date',
          current: getLocalVersion(),
          latest: result.remote.version,
        });
        return;
      }
      const dismissed = await getDismissedInfo();
      if (dismissed && dismissed.version === result.remote.version) {
        const ageMs = Date.now() - dismissed.at;
        if (ageMs < 7 * 24 * 3600 * 1000) {
          DeviceEventEmitter.emit('lulu:update-check-result', {
            status: 'dismissed',
            current: getLocalVersion(),
            latest: result.remote.version,
          });
          return;
        }
      }
      resetUpdateFlow();
      setUpdateInfo(result);
      // Wait for any pending Modal hide animation to finish before
      // showing again. setTimeout(50) was unreliable on Android -- the
      // native Modal can drop a false->true transition that lands
      // within ~300ms of the previous hide. InteractionManager fires
      // AFTER all pending interactions/animations, which is the only
      // reliable way to reopen a Modal that was just dismissed.
      const handle = InteractionManager.runAfterInteractions(() => {
        setVisible(true);
      });
      // Safety net: if the interaction manager never resolves (some
      // Android builds), still open the modal after 350ms.
      setTimeout(() => { try { handle && handle.cancel && handle.cancel(); } catch {}; setVisible(true); }, 350);
      _lastCheck = { at: Date.now(), status: 'update-available', current: getLocalVersion(), latest: result.remote.version, error: '' };
      DeviceEventEmitter.emit('lulu:update-check-result', {
        status: 'update-available',
        current: getLocalVersion(),
        latest: result.remote.version,
      });
    } catch (e) {
      console.warn('[UpdatePrompt] check failed:', e?.message || e);
      _lastCheck = { at: Date.now(), status: 'error', current: getLocalVersion(), latest: '', error: e?.message || String(e) };
      DeviceEventEmitter.emit('lulu:update-check-result', { status: 'error', error: e?.message || String(e) });
    }
  }

  useEffect(() => {
    // 启动时查一次（force 绕过任何缓存）
    runCheck({ force: true });
    // App 回到前台再查（用户离开期间可能有新版本发布）
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runCheck({ force: true });
    });
    return () => sub.remove();
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

  // 依次尝试镜像、GitHub 源。任意一个成功即停止。
  function pickDownloadUrl() {
    const mirrors = updateInfo?.apk?.mirrors || [];
    if (mirrors.length > 0) return mirrors[0];
    return updateInfo.apk.url;
  }

  function buildCandidateUrls() {
    const list = [];
    const mirrors = updateInfo?.apk?.mirrors || [];
    const direct = updateInfo?.apk?.url;
    if (settings?.useProxy) {
      if (direct) list.push(direct);
      for (const m of mirrors) list.push(m);
    } else {
      for (const m of mirrors) list.push(m);
      if (direct) list.push(direct);
    }
    return list;
  }

  async function tryDownloadOne(url, dest, signal) {
    lastProgressAtRef.current = Date.now();
    const task = File.createDownloadTask(url, dest, {
      idempotent: true,
      signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        setReceived(bytesWritten);
        if (totalBytes > 0) {
          setTotal(totalBytes);
          setProgress(Math.round((bytesWritten / totalBytes) * 100));
        } else if (bytesWritten > 0) {
          // We have bytes but no Content-Length. Don't flicker between
          // -1 and 0 -- stay indeterminate (-1) once we know there's
          // actually data coming in.
          setProgress((prev) => (prev < 0 ? prev : -1));
        }
        const now = Date.now();
        setStartTime((prev) => {
          if (prev === 0) return now;
          const elapsed = (now - prev) / 1000;
          if (elapsed >= 0.5) {
            setSpeed(Math.round(bytesWritten / 1024 / elapsed));
            return now;
          }
          return prev;
        });
        // 喂狗
        lastProgressAtRef.current = Date.now();
      },
    });
    downloadTaskRef.current = task;

    // 看门狗：45 秒没收到任何进度就放弃这个源
    const watchdog = setInterval(() => {
      const sinceMs = Date.now() - (lastProgressAtRef.current || 0);
      if (sinceMs >= 45000) {
        clearInterval(watchdog);
        try { task.cancel(); } catch {}
      }
    }, 5000);
    clearInterval(watchdog);
    const file = await task.downloadAsync();
    downloadTaskRef.current = null;
    if (!file) throw new Error("下载被取消");
    return file;
  }

  // Probe a URL by issuing a Range request for the first ~64KB and
  // measuring how long the body took to arrive. Returns speed in KB/s,
  // or 0 on failure. Used to rank mirror sources before downloading
  // the full APK.
  async function probeSpeed(url, signal) {
    const startedAt = Date.now();
    let received = 0;
    let host = 'unknown';
    try { host = new URL(url).hostname; } catch {}
    // Do NOT pass an AbortSignal to fetch here. Some RN fetch polyfills
    // behave badly when an already-aborted signal is used, and we want
    // the outer 6s setTimeout to be the only timer that gates us.
    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-65535' },
      });
    } catch (e) {
      console.warn('[UpdatePrompt] probe failed for', host, e?.message || e);
      return 0;
    }
    if (!res || (!res.ok && res.status !== 206)) return 0;
    let reader;
    try { reader = res.body && res.body.getReader(); } catch {}
    if (!reader) return 0;
    try {
      while (received < 65536) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) received += value.byteLength;
      }
    } catch (e) {
      console.warn('[UpdatePrompt] probe read failed for', host, e?.message || e);
    }
    // Cancel the reader (best-effort). If the response already closed
    // or the reader is gone, swallow that error.
    try { const p = reader.cancel(); if (p && typeof p.then === 'function') await p; } catch {}
    const elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed <= 0) return 0;
    return received / 1024 / elapsed;
  }

  // Probe all candidate URLs in parallel and return them sorted by
  // measured speed (fastest first). Sources that fail to respond are
  // pushed to the end of the list with speed 0 (so they are still
  // attempted as a last resort if every other source failed).
  async function rankBySpeed(urls, signal) {
    if (!urls || urls.length <= 1) return urls || [];
    setErrorMsg(`正在测速 ${urls.length} 个镜像源…`);
    const results = await Promise.all(
      urls.map(async (u) => {
        // Give each probe up to 6s; the slowest will just report 0.
        const perSignal = new AbortController();
        const timer = setTimeout(() => perSignal.abort(), 6000);
        const onAbort = () => { try { perSignal.abort(); } catch {} };
        if (signal) signal.addEventListener('abort', onAbort);
        const speed = await probeSpeed(u, perSignal.signal);
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        return { url: u, speed: speed };
      })
    );
    results.sort((a, b) => b.speed - a.speed);
    const fastest = results[0];
    if (fastest && fastest.speed > 0) {
      let host = 'unknown';
      try { host = new URL(fastest.url).hostname; } catch {}
      setErrorMsg(`测速完成：${host} 最快 (${Math.round(fastest.speed)} KB/s)`);
    } else {
      setErrorMsg('测速失败，将按原顺序尝试');
    }
    return results.map((r) => r.url);
  }

  async function handleDownload() {
    if (!updateInfo?.apk) {
      Alert.alert("下载链接缺失", "请前往 GitHub 仓库手动下载。", [
        { text: "取消", style: "cancel" },
        { text: "打开", onPress: () => Linking.openURL("https://github.com/hzys7/lulu-ledger/releases") },
      ]);
      return;
    }
    setStatus("downloading");
    setProgress(0);
    setInstallError("");
    setShowInstallError(false);
    setSpeed(0);
    setReceived(0);
    setTotal(0);
    setStartTime(0);
    setErrorMsg("");
    const ac = new AbortController();
    abortRef.current = ac;
    const apkName = `update-${updateInfo.apk.name}`;
    const dest = new File(Paths.cache, apkName);
    const initialCandidates = buildCandidateUrls();
    // Probe sources by speed before committing to a full download.
    const candidates = await rankBySpeed(initialCandidates, ac.signal);
    let lastErr = null;
    try {
      for (let i = 0; i < candidates.length; i++) {
        const url = candidates[i];
        if (candidates.length > 1) {
          let host = "源";
          try { host = new URL(url).hostname; } catch {}
          currentSourceRef.current = host;
          setErrorMsg(`正在尝试第 ${i + 1} / ${candidates.length} 个下载源（${host}）…`);
        }
        try {
          const file = await tryDownloadOne(url, dest, ac.signal);
          setLocalFile(file);
          setStatus("done");
          setErrorMsg("");
          if (autoInstallTimerRef.current) clearTimeout(autoInstallTimerRef.current);
          autoInstallTimerRef.current = setTimeout(() => {
            autoInstallTimerRef.current = null;
            handleInstall(file.uri || file.path);
          }, 300);
          abortRef.current = null;
          return;
        } catch (e) {
          if (e?.name === "AbortError") {
            setStatus("idle");
            setErrorMsg("");
            setProgress(0);
            abortRef.current = null;
            return;
          }
          lastErr = e;
          let host = "未知";
          try { host = new URL(url).hostname; } catch {}
          console.warn(`[UpdatePrompt] source ${host} failed:`, e?.message || e);
          const elapsed = lastProgressAtRef.current ? Date.now() - lastProgressAtRef.current : 0;
          if (elapsed >= 30000) {
            setErrorMsg(`${host} 太慢（${Math.round(elapsed / 1000)}s 无响应），跳过…`);
          } else {
            setErrorMsg(`${host} 失败：${e?.message || "未知错误"}`);
          }
          // 清理可能写了一半的半成品文件
          try { await dest.delete(); } catch {}
        }
      }
      throw lastErr || new Error("所有下载源均失败");
    } catch (e) {
      console.warn("[UpdatePrompt] download failed:", e?.message || e);
      setErrorMsg((candidates.length > 1 ? "所有下载源均失败：" : "") + (e?.message || "下载失败"));
      setStatus("error");
      abortRef.current = null;
    }
  }

  // Convert a file:// URI in the app cache dir to a content:// URI
  // served by expo-file-system's FileProvider. Required for
  // android.intent.action.INSTALL_PACKAGE on Android N+; the platform
  // rejects file:// URIs exposed across apps (FileUriExposedException).
  function fileUriToContentUri(fileUri) {
    if (!fileUri || !fileUri.startsWith('file://')) return fileUri;
    const path = fileUri.replace(/^file:\/\//, '');
    const slash = path.lastIndexOf('/');
    const dir = slash >= 0 ? path.substring(0, slash) : '';
    const base = slash >= 0 ? path.substring(slash + 1) : path;
    if (!dir.endsWith('/cache') && !dir.endsWith('/cache/')) {
      return null;
    }
    const pkg = (Application && Application.applicationId) || 'com.lululedger.app';
    return 'content://' + pkg + '.FileSystemFileProvider/cached_expo_files/' + encodeURIComponent(base);
  }
    async function handleInstall(uri) {
    if (!uri) return;
    if (installingRef.current) return;
    installingRef.current = true;
    setStatus('installing');
    try {
      let IntentLauncher;
      try {
        IntentLauncher = require('expo-intent-launcher');
      } catch (e) {
        IntentLauncher = null;
      }
      if (IntentLauncher?.startActivityAsync) {
        const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
        const FLAG_ACTIVITY_NEW_TASK = 0x10000000;
        let contentUri = uri;
        if (uri && uri.startsWith('file://')) {
          const mapped = fileUriToContentUri(uri);
          if (mapped) contentUri = mapped;
        }
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: contentUri,
          type: 'application/vnd.android.package-archive',
          flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
        });
        return;
      }
      await Linking.openURL(uri);
    } catch (e) {
      const msg = e?.message || String(e);
      // If the intent is already started (e.g. we re-entered from a
      // stale setTimeout), don't show a scary red box -- the system
      // install dialog is already on screen.
      if (/already started/i.test(msg)) {
        // Keep installingRef=true; the in-flight activity will pop.
        return;
      }
      installingRef.current = false;
      setStatus('done');
      setInstallError(msg);
      setShowInstallError(true);
    }
  }

  function openFileManager() {
    if (!localFile) return;
    const path = localFile.uri || localFile.path;
    // On Android N+, file:// URIs are blocked in cross-app Intents; try the
    // FileProvider-backed content:// first, then fall back.
    const __openTarget = (Platform.OS === 'android' && path && path.startsWith && path.startsWith('file://'))
      ? (fileUriToContentUri(path) || path)
      : 'file://' + path;
    Linking.openURL(__openTarget).catch(() => {
      Alert.alert('提示', '请用文件管理器打开：' + path);
    });
  }

  function handleLater() {
    setVisible(false);
    resetUpdateFlow();
    setUpdateInfo(null);
  }

  async function handleSkip() {
    if (updateInfo?.remote?.version) {
      await setDismissedInfo(updateInfo.remote.version);
    }
    setVisible(false);
    resetUpdateFlow();
    setUpdateInfo(null);
  }

  if (!updateInfo) return null;

  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version;
  // When the release comes from the GitHub API we get a real size; when
  // it comes from the Atom feed (fallback in mainland China) size is 0.
  // Show '未知' instead of a misleading '0.0 MB'.
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
              onPress={() => Linking.openURL(updateInfo?.remote?.html_url || "https://github.com/hzys7/lulu-ledger/releases")}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="open-outline" size={13} color={tc.primary} />
              <Text style={[styles.githubLinkText, { color: tc.primary }]}>
                打不开？去 GitHub 手动下载
              </Text>
            </TouchableOpacity>

            </>          ) : null}

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
              onPress={() => Linking.openURL(updateInfo?.remote?.html_url || "https://github.com/hzys7/lulu-ledger/releases")}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={14} color={tc.primary} />
              <Text style={[styles.githubLinkText, { color: tc.primary, fontWeight: fontWeight.semibold }]}>
                打开 GitHub 页面手动下载
              </Text>
            </TouchableOpacity>

            </>          ) : null}

          {status === 'done' ? (
            <View style={styles.doneBlock}>
              <Text style={[styles.doneText, { color: tc.success }]}>下载完成，正在唤起安装...</Text>
              {(installError || showInstallError) ? (
                <View style={[styles.installErrorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger }]}>
                  <Ionicons name="alert-circle" size={14} color={tc.danger} />
                  <Text style={[styles.installErrorText, { color: tc.danger }]}>
                    未能自动安装：{installError || '未知错误'}
                  </Text>
                </View>
              ) : null}
              {localFile ? (
                <View style={styles.pathBlock}>
                  <Text style={[styles.pathLabel, { color: tc.textMuted }]}>APK 已下载到：</Text>
                  <Text style={[styles.pathValue, { color: tc.text }]} selectable numberOfLines={2}>
                    {localFile.uri || localFile.path}
                  </Text>
                  <View style={styles.pathActions}>
                    <TouchableOpacity
                      style={[styles.pathBtn, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
                      onPress={openFileManager}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="folder-open-outline" size={14} color={tc.text} />
                      <Text style={[styles.pathBtnText, { color: tc.text }]}>打开文件位置</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pathBtn, { backgroundColor: tc.primary }]}
                      onPress={() => handleInstall(localFile.uri || localFile.path)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="download" size={14} color={tc.primaryOn} />
                      <Text style={[styles.pathBtnText, { color: tc.primaryOn }]}>再次安装</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.btnRow}>
            {status === 'idle' || status === 'error' ? (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]}
                  onPress={handleLater}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>稍后</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]}
                  onPress={handleSkip}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>忽略此版</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.4 }]}
                  onPress={handleDownload}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>立即更新</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {status === 'downloading' ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { borderColor: tc.border, flex: 1 }]}
                onPress={() => {
                  try { abortRef.current?.abort?.(); } catch {}
                  try { downloadTaskRef.current?.cancel?.(); } catch {}
                  setStatus('idle');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>取消下载</Text>
              </TouchableOpacity>
            ) : null}
            {status === 'done' && localFile ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1 }]}
                onPress={() => handleInstall(localFile.uri || localFile.path)}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>点击安装</Text>
              </TouchableOpacity>
            ) : null}
            {status === 'installing' ? (
              <View style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1, opacity: 0.6 }]}>
                <ActivityIndicator size="small" color={tc.primaryOn} />
              </View>
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
  progressBlock: {
    marginBottom: spacing.base,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  errorText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  doneBlock: { marginBottom: spacing.base },
  installErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    gap: 4,
  },
  installErrorText: { fontSize: fontSize.xs, flex: 1, lineHeight: 17 },
  pathBlock: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  pathLabel: { fontSize: fontSize.xs, marginBottom: 2 },
  pathValue: {
    fontSize: fontSize.xs,
    fontFamily: Platform.OS === "android" ? "monospace" : "Menlo",
    backgroundColor: "rgba(0,0,0,0.04)",
    padding: 6,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  pathActions: { flexDirection: "row", gap: 6 },
  pathBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  pathBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  doneText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.base,
    fontWeight: fontWeight.medium,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  progressMeta: { fontSize: fontSize.xs, fontVariant: ["tabular-nums"] },
  githubLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  githubLinkProminent: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "center",
  },
  githubLinkText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, letterSpacing: 0.1 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {},
  btnSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  btnSecondaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
});
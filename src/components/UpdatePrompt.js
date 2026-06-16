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
  Linking,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Application from 'expo-application';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';

// Custom native module — bypasses expo-intent-launcher, constructs the
// Intent directly in Kotlin so there is no JS-bridge / setDataAndType bug.
// The module is auto-discovered by Expo from modules/lulu-apk-installer/.
let LuluApkInstaller = null;
try {
  const { requireNativeModule } = require('expo-modules-core');
  LuluApkInstaller = requireNativeModule('LuluApkInstaller');
} catch (e) {
  // Module not available (web / dev build without EAS). That's fine;
  // handleInstall will fall through to expo-sharing.
}

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
  // Reentrancy guard: handleInstall may be called both automatically
  // 300ms after download completes and again when the user taps
  // the install button. expo-intent-launcher rejects the second call
  // with 'IntentLauncher activity is already started'.
  const installingRef = useRef(false);
  const lastProgressAtRef = useRef(0);
  const lastBytesRef = useRef(0);
  const currentSourceRef = useRef("");
  // Track the post-download auto-install setTimeout so we can cancel it
  // if the user dismisses the modal (otherwise it fires into a closed
  // modal and leaves installingRef=true forever).
  const autoInstallTimerRef = useRef(null);
  // While a download or install is in flight, suppress the AppState
  // 'active' listener from re-running the check. Otherwise when the
  // system install dialog steals focus and the user comes back, the
  // re-check sees the same remote version, calls setVisible(true),
  // and immediately overlays the install dialog with a brand-new
  // 'Update available' modal -- effectively a download/install loop.
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

  // Reset all per-check state. Called whenever a new update flow begins
  // (or the modal is dismissed) so we never get stuck in 'installing'
  // or 'done' from a previous round.
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
    // Clear update info and visibility so subsequent checks start fresh.
    // Without this, after a failed install attempt the modal stays hidden
    // even when runCheck() calls setVisible(true) again.
    setUpdateInfo(null);
    setVisible(false);
  }

  async function runCheck({ force } = {}) {
    // If a download/install flow is in flight, do not start another
    // check. This guards against both the AppState 'active' listener
    // and the Settings 'check now' button from interrupting a flow.
    //
    // EXCEPTION: when the user explicitly taps 'Check now' (force=true),
    // a stuck flowActiveRef from a prior failed download/install must
    // not silently block the new check. Recover by clearing the ref and
    // continuing. Without this, the Settings page would poll
    // getLastUpdateCheck(), see the stale 'up-to-date' / 'error' status
    // left over from the last run, and report the wrong verdict to the
    // user -- which is the bug fixed in 1.2.42.
    if (flowActiveRef.current) {
      if (!force) return;
      console.warn('[UpdatePrompt] force-checking while a previous flow is in flight; clearing flowActiveRef');
      flowActiveRef.current = false;
    }
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
        // 1.2.43 fix: also write _lastCheck here, not just emit. Without
        // this, the Settings 'Check now' polling useEffect reads a
        // stale status from the previous run and shows 'up-to-date'
        // even though the current run failed to reach the network.
        _lastCheck = { at: Date.now(), status: 'error', current: getLocalVersion(), latest: '', error: '网络请求失败' };
        DeviceEventEmitter.emit('lulu:update-check-result', { status: 'error', error: '网络请求失败', current: getLocalVersion() });
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
      setVisible(true);
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
    // 启动时查一次。这是 1.2.44 唯一保留的自动检查路径：
    //   1) APP 启动时（这里）
    //   2) 用户在 Settings 里点"立即检查更新"（triggerUpdateCheck）
    // 1.2.43 加的 AppState 'active' 监听被删掉，理由：
    //   - 用户明确说"其他时候不需要自动检测"
    //   - 1.2.33 之前因为它导致系统安装 dialog 弹起时循环 re-check
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
          if (prev === 0) {
            lastBytesRef.current = bytesWritten;
            return now;
          }
          const elapsed = (now - prev) / 1000;
          if (elapsed >= 0.5) {
            const deltaBytes = bytesWritten - lastBytesRef.current;
            lastBytesRef.current = bytesWritten;
            setSpeed(Math.round(deltaBytes / 1024 / elapsed));
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
    try {
      const file = await task.downloadAsync();
      downloadTaskRef.current = null;
      if (!file) throw new Error("下载被取消");
      return file;
    } finally {
      clearInterval(watchdog);
    }
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
    // Pass the AbortSignal so the fetch can be cancelled if the parent
    // download is aborted. Each probe also has its own 6s timeout from
    // the rankBySpeed caller.
    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-65535' },
        signal,
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

  async function checkInstallPermission() {
    if (Platform.OS !== 'android') return true;
    try {
      if (LuluApkInstaller && typeof LuluApkInstaller.isInstallPermissionGranted === 'function') {
        const granted = await LuluApkInstaller.isInstallPermissionGranted();
        return granted !== false; // treat null/undefined as denied
      }
    } catch (e) {
      console.warn('[UpdatePrompt] permission check failed:', e?.message || e);
    }
    // Can't check — assume not granted so we show the guidance
    return false;
  }

  async function handleDownload() {
    if (!updateInfo?.apk) {
      Alert.alert("下载链接缺失", "请前往 GitHub 仓库手动下载。", [
        { text: "取消", style: "cancel" },
        { text: "打开", onPress: () => Linking.openURL("https://github.com/hzys7/lulu-ledger/releases") },
      ]);
      return;
    }

    // --- Step 0: Check install permission BEFORE downloading ---
    // On Android 8+, the user must explicitly enable "Install unknown apps"
    // for this app in system settings. If we skip this check, the download
    // finishes but installation silently fails.
    if (Platform.OS === 'android') {
      const hasPermission = await checkInstallPermission();
      if (!hasPermission) {
        // 首先尝试通过原生模块直接弹出系统权限确认弹窗
        // 使用 ACTION_MANAGE_UNKNOWN_APP_SOURCES intent，这是修复
        // "开关灰色不可点击"问题的关键：系统会弹出确认对话框，
        // 用户点"允许"后权限即刻生效，无需手动去设置页操作。
        let directGranted = false;
        if (LuluApkInstaller && typeof LuluApkInstaller.requestInstallPermission === 'function') {
          try {
            directGranted = await LuluApkInstaller.requestInstallPermission();
          } catch (e) {
            console.warn('[UpdatePrompt] direct permission request failed:', e?.message || e);
          }
        }

        if (directGranted) {
          // 权限已获取，继续下载
        } else {
          // 原生请求失败，引导用户手动去设置页
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

    // 1.2.47: outer try/catch wraps the entire body. Without it, an
    // exception thrown outside the inner try (rankBySpeed,
    // buildCandidateUrls, the pre-loop setErrorMsg state updates
    // when the component has just been unmounted) escapes the
    // function, React swallows it, and the user sees the modal
    // stuck on 'downloading' with no error message and no
    // progress -- the 'nothing happens when I tap Update' bug.
    try {
      flowActiveRef.current = true;
      setStatus("downloading");
      setProgress(0);
      setInstallError("");
      setShowInstallError(false);
      setSpeed(0);
      setReceived(0);
      setTotal(0);
      setStartTime(0);
      lastBytesRef.current = 0;
      setErrorMsg("");
      const ac = new AbortController();
      abortRef.current = ac;
      const apkName = `update-${updateInfo.apk.name}`;
      const dest = new File(Paths.cache, apkName);
      const initialCandidates = buildCandidateUrls();
      // Probe sources by speed before committing to a full download.
      const candidates = await rankBySpeed(initialCandidates, ac.signal);
    let lastErr = null;
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
          abortRef.current = null;
          // Auto-install 500ms after download completes.
          // The user can still tap "点击安装" before the timer fires;
          // handleInstall's installingRef guard will prevent double-launch.
          autoInstallTimerRef.current = setTimeout(() => {
            autoInstallTimerRef.current = null;
            handleInstall(file.uri || file.path);
          }, 500);
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
    // 1.2.47: all sources failed. Surface a clear, actionable error in the
    // modal instead of calling a (non-existent) helper. Also clear the
    // flow guard so the next tap of "立即更新" is not silently blocked.
    const failed = lastErr || new Error("所有下载源均失败");
    console.warn("[UpdatePrompt] all sources failed:", failed?.message || failed);
    setErrorMsg("下载失败：" + (failed?.message || "未知错误") + "。可稍后重试，或前往 GitHub 手动下载。");
    setStatus("error");
    abortRef.current = null;
    flowActiveRef.current = false;
  } catch (e) {
    // 1.2.47: outer catch for anything that escaped the inner try
    // (rankBySpeed, buildCandidateUrls, post-await state updates).
    // Inline (no helper) so the candidates closure stays in scope.
    console.warn("[UpdatePrompt] download failed (outer):", e?.message || e);
    setErrorMsg("下载失败：" + (e?.message || String(e)));
    setStatus("error");
    abortRef.current = null;
    flowActiveRef.current = false;
  }
  }

  // Convert a file:// URI in the app cache dir to a content:// URI
  // served by expo-file-system's FileProvider. Required for
  // android.intent.action.VIEW on Android N+; the platform
  // rejects file:// URIs exposed across apps (FileUriExposedException).
  //
  // The FileProvider authority is: {applicationId}.FileSystemFileProvider
  // (registered in expo-file-system's AndroidManifest.xml),
  // and the cache directory path alias is "cached_expo_files".
  function fileUriToContentUri(fileUri) {
    if (!fileUri || !fileUri.startsWith('file://')) return null;
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

  // Quick size check before trying to install.  Reject files under 1 MB
  // (too small to be a real APK — likely a truncated / failed download).
  async function verifyApkIntegrity(fileUri) {
    try {
      const apkFile = new File(fileUri);
      const info = await apkFile.info();
      if (!info || !info.exists || info.size < 1 * 1024 * 1024) {
        return { ok: false, reason: '文件大小异常（' + ((info && info.size) || 0) + ' B）' };
      }
      return { ok: true };
    } catch (e) {
      // If info() is not available (e.g. raw path instead of File object),
      // skip the check and try anyway.
      console.warn('[UpdatePrompt] integrity check skipped:', e?.message || e);
      return { ok: true };
    }
  }

  async function openInstallSettings() {
    try {
      let IntentLauncher;
      try { IntentLauncher = require('expo-intent-launcher'); } catch {}
      if (IntentLauncher?.startActivityAsync) {
        const pkg = (Application && Application.applicationId) || 'com.lululedger.app';
        // 优先使用 ACTION_MANAGE_UNKNOWN_APP_SOURCES（权限请求弹窗）
        // 而不是 android.settings.MANAGE_UNKNOWN_APP_SOURCES（设置页面）
        // 前者会触发系统权限确认弹窗，后者仅展示设置页（开关可能灰色不可点）
        try {
          await IntentLauncher.startActivityAsync(
            'android.intent.action.MANAGE_UNKNOWN_APP_SOURCES',
            { data: 'package:' + pkg }
          );
          return;
        } catch {
          // 如果 ACTION 不可用，回退到设置页面
        }
        try {
          await IntentLauncher.startActivityAsync(
            'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
            { data: 'package:' + pkg }
          );
          return;
        } catch {
          // 最终回退
        }
      }
      Linking.openSettings();
    } catch {
      Linking.openSettings();
    }
  }

  async function handleInstall(uri) {
    if (!uri) return;
    if (installingRef.current) return;
    installingRef.current = true;
    try {
      // --- Step 0: verify APK integrity before touching the Intent ---
      const filePath = uri.replace(/^file:\/\//, '');
      const check = await verifyApkIntegrity(filePath);
      if (!check.ok) {
        throw new Error('APK 验证失败：' + check.reason + '。请重新下载。');
      }

      // Build the content:// URI for the native module
      let contentUri = uri;
      if (uri.startsWith('file://')) {
        const mapped = fileUriToContentUri(uri);
        if (!mapped) {
          throw new Error('无法生成文件访问 URI（不在缓存目录中）');
        }
        contentUri = mapped;
      }

      // --- Method 1: Custom native module (primary) ---
      // Directly constructs the Intent in Kotlin, bypassing all
      // JS-bridge bugs in expo-intent-launcher.
      if (LuluApkInstaller && typeof LuluApkInstaller.installApk === 'function') {
        try {
          await LuluApkInstaller.installApk(contentUri);
          // startActivity resolves immediately (fire-and-forget).
          // The user is now looking at the PackageInstaller dialog.
          flowActiveRef.current = false;
          installingRef.current = false;
          setStatus('installing');
          return;
        } catch (e1) {
          console.warn('[UpdatePrompt] native module install failed:', e1?.message || e1);
        }
      }

      // --- Method 2: expo-sharing (fallback) ---
      // Opens the system share sheet; user picks PackageInstaller.
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

      // --- Method 3: Linking.openURL (last resort) ---
      try {
        await Linking.openURL(contentUri);
        flowActiveRef.current = false;
        installingRef.current = false;
        setStatus('installing');
        return;
      } catch (e3) {
        console.warn('[UpdatePrompt] Linking.openURL failed:', e3?.message || e3);
      }

      // All methods failed.
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

            </>          ) : null}            {status === 'done' ? (
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
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1 }]}
                onPress={handleLater}
                activeOpacity={0.85}
              >
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
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    gap: 6,
  },
  installErrorText: { fontSize: fontSize.xs, flex: 1, lineHeight: 17 },
  settingsLinkBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  settingsLinkText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  doneText: {
    fontSize: fontSize.md,
    textAlign: 'center',
    fontWeight: fontWeight.semibold,
  },
  doneSubText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.base,
    marginTop: spacing.xs,
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
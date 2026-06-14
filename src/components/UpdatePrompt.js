// 璐璐记账 · 自动更新提示
// App 启动时检查 GitHub Releases，发现新版本弹窗让用户点下载
import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import { useFinance } from '../context/FinanceContext';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';

const DISMISSED_KEY = 'lulu_update_dismissed';

export default function UpdatePrompt() {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [localFile, setLocalFile] = useState(null);
  const downloadTaskRef = useRef(null);

  async function runCheck() {
    try {
      const result = await checkForUpdate();
      if (!result.hasUpdate) return;
      const dismissed = await getDismissedInfo();
      if (dismissed && dismissed.version === result.remote.version) {
        const ageMs = Date.now() - dismissed.at;
        if (ageMs < 7 * 24 * 3600 * 1000) return;
      }
      setUpdateInfo(result);
      setVisible(true);
    } catch (e) {
      console.warn('[UpdatePrompt] check failed:', e?.message || e);
    }
  }

  useEffect(() => {
    // 启动时查一次
    runCheck();
    // App 回到前台再查（避免启动时网络失败被错过）
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runCheck();
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

  async function handleDownload() {
    if (!updateInfo?.apk) {
      Alert.alert('下载链接缺失', '请前往 GitHub 仓库手动下载。', [
        { text: '取消', style: 'cancel' },
        { text: '打开', onPress: () => Linking.openURL('https://github.com/hzys7/lulu-ledger/releases') },
      ]);
      return;
    }
    setStatus('downloading');
    setProgress(0);
    setErrorMsg('');
    try {
      const apkName = `update-${updateInfo.apk.name}`;
      const dest = new File(Paths.cache, apkName);
      // 用 fetch 下载 + 跟踪进度（不依赖 expo-file-system 不稳定的新 API）
      const res = await fetch(updateInfo.apk.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = parseInt(res.headers.get('content-length') || '0', 10);
      // 读取 Response body 流，跟踪进度
      const reader = res.body?.getReader();
      const chunks = [];
      let received = 0;
      if (reader && total) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length || 0;
          setProgress(Math.round((received / total) * 100));
        }
      } else {
        // 降级：直接拿 blob
        const blob = await res.blob();
        chunks.push(blob);
        setProgress(50);
      }
      // 写文件
      const combined = new Blob(chunks);
      await dest.write(combined);
      setLocalFile(dest);
      setStatus('done');
      // 自动唤起安装
      setTimeout(() => handleInstall(dest.uri || dest.path), 300);
    } catch (e) {
      console.warn('[UpdatePrompt] download failed:', e?.message || e);
      setErrorMsg(e?.message || '下载失败');
      setStatus('error');
    }
  }

  async function handleInstall(uri) {
    if (!uri) return;
    // Android 上用 Intent 唤起安装器
    // file:// 在 Android 10+ 会被 FileProvider 拦截，这里走 content://
    // expo-intent-launcher 是最稳的；用 Linking 兜底
    try {
      // 优先尝试用 expo-intent-launcher（如果装了）
      try {
        // 动态模块名绕开 Metro 静态分析（包可能没装）
        const modName = 'expo' + '-intent-launcher';
        const IntentLauncher = require(modName);
        // 获取应用包名和 authority
        const cnf = IntentLauncher;
        if (cnf?.startActivityAsync) {
          await cnf.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
            data: uri,
            flags: 1, // grant read URI permission
            type: 'application/vnd.android.package-archive',
          });
          return;
        }
      } catch {}
      // 兜底：用 Linking
      await Linking.openURL(uri);
    } catch (e) {
      Alert.alert(
        '无法自动安装',
        '请到文件管理找到下载的 APK 文件手动安装。\n\n' + (e?.message || ''),
      );
    }
  }

  function handleLater() {
    setVisible(false);
    // 标记这个版本本次会话内不再弹
  }

  async function handleSkip() {
    if (updateInfo?.remote?.version) {
      await setDismissedInfo(updateInfo.remote.version);
    }
    setVisible(false);
  }

  if (!updateInfo) return null;

  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version;
  const fileSizeMB = updateInfo.apk ? (updateInfo.apk.size / 1024 / 1024).toFixed(1) : '?';

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
            <View style={[styles.notesBox, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
              <Text style={[styles.notesTitle, { color: tc.text }]}>更新内容</Text>
              <Text style={[styles.notesBody, { color: tc.textSecondary }]} numberOfLines={6}>
                {updateInfo.remote.body}
              </Text>
            </View>
          ) : null}

          {status === 'downloading' ? (
            <View style={styles.progressBlock}>
              <View style={[styles.progressBg, { backgroundColor: tc.surfaceMuted }]}>
                <View style={[styles.progressFill, { backgroundColor: tc.primary, width: `${progress}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: tc.textMuted }]}>{progress}%</Text>
            </View>
          ) : null}

          {status === 'error' ? (
            <Text style={[styles.errorText, { color: tc.danger }]}>{errorMsg}</Text>
          ) : null}

          {status === 'done' ? (
            <Text style={[styles.doneText, { color: tc.success }]}>下载完成，正在唤起安装...</Text>
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
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
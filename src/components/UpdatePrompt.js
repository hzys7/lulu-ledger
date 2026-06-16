// 小璐记账 · 自动更新提示（纯 JS 方案）
// 检测到新版本时引导用户去 GitHub 下载 APK

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
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';
import { checkForUpdate, getLocalVersion } from '../utils/updateChecker';

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

  function handleDownload() {
    if (!updateInfo?.apk) {
      Linking.openURL('https://github.com/hzys7/lulu-ledger/releases');
      return;
    }
    // 直接打开浏览器下载
    Linking.openURL(updateInfo.apk.url).catch(() => {
      // 主链接失败，尝试镜像
      const mirror = updateInfo.apk.mirrors?.[0];
      if (mirror) Linking.openURL(mirror).catch(() => {});
    });
    setVisible(false);
  }

  function handleLater() {
    setVisible(false);
  }

  async function handleSkip() {
    if (updateInfo?.remote?.version) {
      await setDismissedInfo(updateInfo.remote.version);
    }
    setVisible(false);
  }

  if (!updateInfo) return null;

  const localVer = getLocalVersion();
  const remoteVer = updateInfo.remote?.version || '???';

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

          {updateInfo.remote?.body ? (
            <View style={[styles.notesBox, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
              <Text style={[styles.notesTitle, { color: tc.text }]}>更新内容</Text>
              <Text style={[styles.notesBody, { color: tc.textSecondary }]} numberOfLines={6}>
                {updateInfo.remote.body}
              </Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleLater} activeOpacity={0.7}>
              <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>稍后</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary, { borderColor: tc.border }]} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={[styles.btnSecondaryText, { color: tc.textSecondary }]}>忽略此版</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: tc.primary, flex: 1.4 }]} onPress={handleDownload} activeOpacity={0.85}>
              <Text style={[styles.btnPrimaryText, { color: tc.primaryOn }]}>前往下载</Text>
            </TouchableOpacity>
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
  notesBox: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, marginBottom: spacing.base,
  },
  notesTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  notesBody: { fontSize: fontSize.sm, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: {},
  btnSecondary: { borderWidth: StyleSheet.hairlineWidth },
  btnPrimaryText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  btnSecondaryText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
});

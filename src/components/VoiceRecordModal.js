// 小璐记账 · 语音记账浮层
// 交互：按住说话 → 松手识别 → 预览确认 → 保存
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { startRecording, stopRecording, voiceToTransaction, ensureAudioPermission } from '../utils/aiVoice';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
  categories as categoryConfig,
} from '../theme';

// 振动反馈（无权限静默失败）
function vibrateTap() {
  try {
    Platform.OS === 'ios'
      ? Vibration.vibrate([0, 20])
      : Vibration.vibrate(10);
  } catch {}
}

function vibrateLong() {
  try {
    Platform.OS === 'ios'
      ? Vibration.vibrate([0, 80])
      : Vibration.vibrate(40);
  } catch {}
}

export default function VoiceRecordModal({ visible, onClose, onSaved }) {
  const { settings, addTx, accounts } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const currencySymbol = getCurrencySymbol(settings.currency);

  // 状态机：idle → recording → processing → preview
  const [stage, setStage] = useState('idle'); // idle | recording | processing | preview
  const [error, setError] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [parsed, setParsed] = useState(null);

  const recordingRef = useRef(null);
  // 倒计时水位（粗糙防误触：<0.6s 算无效）
  const holdStartRef = useRef(0);
  // 录音动画值
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef(null);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setStage('idle');
      setError('');
      setTranscribedText('');
      setParsed(null);
    }
  }, [visible]);

  // 呼吸灯动画
  useEffect(() => {
    if (stage === 'recording') {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      if (pulseRef.current) {
        pulseRef.current.stop();
        pulseRef.current = null;
      }
      pulseAnim.setValue(1);
    }
    return () => {
      if (pulseRef.current) pulseRef.current.stop();
    };
  }, [stage, pulseAnim]);

  // 清理录音
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        stopRecording(recordingRef.current).catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  // ─── 按住开始录音 ────────────────────────────────
  const handlePressIn = useCallback(async () => {
    if (stage !== 'idle') return;
    setError('');
    vibrateTap();

    const permOk = await ensureAudioPermission();
    if (!permOk) {
      setError('麦克风权限未授权，请在系统设置中开启');
      return;
    }

    try {
      const rec = await startRecording();
      recordingRef.current = rec;
      holdStartRef.current = Date.now();
      setStage('recording');
    } catch (e) {
      setError('录音启动失败：' + (e.message || '未知错误'));
    }
  }, [stage]);

  // ─── 松手停止录音并识别 ──────────────────────────
  const handlePressOut = useCallback(async () => {
    if (stage !== 'recording') return;
    const elapsed = Date.now() - holdStartRef.current;

    // 先停止录音
    const rec = recordingRef.current;
    recordingRef.current = null;
    const uri = await stopRecording(rec);

    // 防误触：< 0.6 秒视为无效
    if (elapsed < 600 || !uri) {
      setStage('idle');
      setError('按住时间太短，请长按说话');
      return;
    }

    setStage('processing');
    vibrateLong();

    // 语音 → 账目
    const result = await voiceToTransaction(uri);
    if (!result.ok) {
      setStage('idle');
      setError(result.error || '识别失败，请重试');
      if (result.transcribedText) {
        setTranscribedText(result.transcribedText);
      }
      return;
    }

    setTranscribedText(result.transcribedText || '');
    setParsed(result.data);
    setStage('preview');
  }, [stage]);

  // ─── 保存 ─────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!parsed) return;
    const defaultAccId = (accounts.find((a) => a.isDefault) || accounts[0])?.id;
    await addTx({
      type: parsed.type,
      amount: parsed.amount,
      category: parsed.category,
      note: parsed.note || '',
      date: parsed.date,
      currency: settings.currency,
      accountId: defaultAccId,
    });
    onSaved?.(parsed);
  }, [parsed, accounts, settings.currency, addTx, onSaved]);

  // ─── 重试 ─────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setStage('idle');
    setError('');
    setTranscribedText('');
    setParsed(null);
  }, []);

  const catInfo = parsed ? categoryConfig[parsed.type].find((c) => c.name === parsed.category) : null;
  const catColor = parsed ? (getThemeColors(settings.theme).categories[parsed.category] || tc.textMuted) : tc.textMuted;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* 顶部关闭按钮 */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => { setStage('idle'); setError(''); setParsed(null); onClose(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.closeBtn, { backgroundColor: tc.surface + 'CC' }]}
          >
            <Ionicons name="close" size={24} color={tc.text} />
          </TouchableOpacity>
        </View>

        {/* ─── 内容区 ─────────────────────────────────── */}
        <View style={styles.center}>
          {stage === 'idle' && (
            <View style={styles.idleArea}>
              {/* 麦克风图标 */}
              <View style={[styles.micOuter, { backgroundColor: tc.surface + 'E6', borderColor: tc.border }]}>
                <Ionicons name="mic" size={48} color={tc.primary} />
              </View>
              <TouchableOpacity
                style={styles.holdZone}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
              >
                <View style={[styles.holdBtn, { backgroundColor: tc.primary }]}>
                  <Ionicons name="mic" size={24} color={tc.primaryOn} />
                  <Text style={[styles.holdBtnText, { color: tc.primaryOn }]}>按住说话</Text>
                </View>
              </TouchableOpacity>
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: tc.dangerSubtle }]}>
                  <Ionicons name="alert-circle" size={16} color={tc.danger} />
                  <Text style={[styles.errorText, { color: tc.danger }]}>{error}</Text>
                </View>
              ) : (
                <Text style={[styles.hint, { color: tc.textMuted }]}>
                  松手自动识别 · 例如「昨天吃饭花了 80」
                </Text>
              )}
            </View>
          )}

          {stage === 'recording' && (
            <View style={styles.recordingArea}>
              <Animated.View style={[
                styles.recordingRing,
                {
                  backgroundColor: tc.danger,
                  borderColor: tc.danger,
                  transform: [{ scale: pulseAnim }],
                },
              ]}>
                <Ionicons name="mic" size={56} color="#FFFFFF" />
              </Animated.View>
              <Text style={[styles.recordingText, { color: tc.danger }]}>正在聆听...</Text>
              <Text style={[styles.recordingHint, { color: tc.textMuted }]}>松手结束录音</Text>
            </View>
          )}

          {stage === 'processing' && (
            <View style={styles.processingArea}>
              <ActivityIndicator size="large" color={tc.primary} />
              <Text style={[styles.processingText, { color: tc.text }]}>识别中...</Text>
            </View>
          )}

          {stage === 'preview' && parsed && (
            <View style={styles.previewArea}>
              {/* 转写文字 */}
              {transcribedText ? (
                <View style={[styles.transcribeBox, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                  <Ionicons name="chatbox-ellipses" size={14} color={tc.textMuted} />
                  <Text style={[styles.transcribeText, { color: tc.textSecondary }]} numberOfLines={3}>
                    {transcribedText}
                  </Text>
                </View>
              ) : null}

              {/* 解析结果卡片 */}
              <View style={[styles.resultCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.resultRow}>
                  <View style={[styles.resultCatIcon, { backgroundColor: catColor + '22' }]}>
                    <Ionicons name={catInfo?.icon || 'ellipse'} size={20} color={catColor} />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultCat, { color: tc.text }]}>{parsed.category}</Text>
                    {parsed.note ? (
                      <Text style={[styles.resultNote, { color: tc.textMuted }]}>{parsed.note}</Text>
                    ) : null}
                  </View>
                  <Text style={[
                    styles.resultAmount,
                    { color: parsed.type === 'income' ? tc.success : tc.text },
                  ]}>
                    {parsed.type === 'income' ? '+' : '-'}{currencySymbol}{formatMoney(parsed.amount, settings.currency).replace(/[^0-9.,]/g, '')}
                  </Text>
                </View>
              </View>

              {/* 操作按钮 */}
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={[styles.previewBtn, { backgroundColor: tc.primary }]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={20} color={tc.primaryOn} />
                  <Text style={[styles.previewBtnText, { color: tc.primaryOn }]}>确认记账</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.previewBtnOutline, { borderColor: tc.border }]}
                  onPress={handleRetry}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={18} color={tc.textMuted} />
                  <Text style={[styles.previewBtnOutlineText, { color: tc.textMuted }]}>重新录音</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 底部安全区 */}
        <View style={{ height: 24 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  // idle
  idleArea: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  micOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: spacing.sm,
    ...shadows.lg,
  },
  holdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    ...shadows.lg,
  },
  holdBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  holdZone: {
    // 扩大触摸区域，但不改变视觉
    padding: spacing.base,
  },
  hint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  errorText: {
    fontSize: fontSize.sm,
    flex: 1,
  },

  // recording
  recordingArea: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  recordingRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    borderWidth: 3,
  },
  recordingText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  recordingHint: {
    fontSize: fontSize.sm,
  },

  // processing
  processingArea: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  processingText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },

  // preview
  previewArea: {
    width: '100%',
    gap: spacing.md,
  },
  transcribeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  transcribeText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  resultCard: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    ...shadows.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultCatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultCat: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },
  resultNote: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  resultAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: borderRadius.md,
  },
  previewBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  previewBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewBtnOutlineText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
});

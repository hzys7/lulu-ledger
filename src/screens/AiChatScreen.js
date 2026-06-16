// 小璐记账 · AI 智能记账（全屏弹窗）
// 流程：用户输入自然语言 → 调 AI 解析 → 预览结果 → 保存
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors, categories as categoryConfig } from '../theme';
import { parseTransactionFromText } from '../utils/aiParser';
import { loadAiConfig } from '../utils/aiConfig';

const SUGGESTIONS = [
  '昨天打车 35',
  '今天中午吃火锅 120',
  '工资到账 8000',
  '上周三买了件衣服 299',
  '早上买咖啡 18',
];

export default function AiChatScreen({ visible, onClose, onSaved }) {
  const { settings, addTx, accounts } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null); // 单笔：{ amount, type, category, date, note }
  const [parsedList, setParsedList] = useState(null); // 多笔：[{ ... }, { ... }]
  const [error, setError] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardH(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardH(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      setText('');
      setParsed(null);
      setParsedList(null);
      setError('');
      setParsing(false);
      // 检查 AI 是否启用
      (async () => {
        const cfg = await loadAiConfig();
        setAiEnabled(!!cfg.enabled);
        setHasApiKey(!!cfg.apiKey);
      })();
      // 自动聚焦
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setParsing(true);
    setError('');
    setParsed(null);
    setParsedList(null);
    const res = await parseTransactionFromText(trimmed);
    setParsing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.multiple && Array.isArray(res.data)) {
      setParsedList(res.data);
    } else {
      setParsed(res.data);
    }
  }

  async function handleSave() {
    if (parsedList && parsedList.length > 0) {
      const defaultAccId = (accounts.find((a) => a.isDefault) || accounts[0])?.id;
      for (const item of parsedList) {
        await addTx({
          type: item.type,
          amount: item.amount,
          category: item.category,
          note: item.note || '',
          date: item.date,
          currency: settings.currency,
          accountId: defaultAccId,
        });
      }
      onSaved?.(parsedList);
      return;
    }
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
  }

  function handleReParse() {
    setParsed(null);
    setParsedList(null);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const catInfo = parsed ? categoryConfig[parsed.type].find((c) => c.name === parsed.category) : null;
  const catColor = parsed ? (tc.categories[parsed.category] || tc.textMuted) : tc.textMuted;
  const currencySymbol = getCurrencySymbol(settings.currency);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: tc.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* 顶栏 */}
          <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: tc.divider, backgroundColor: tc.background }]}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
            <Text style={[styles.topTitle, { color: tc.text }]}>AI 智能记账</Text>
            <View style={{ width: 32 }} />
          </View>

          {!aiEnabled || !hasApiKey ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={[styles.emptyTitle, { color: tc.text }]}>
                {!aiEnabled ? 'AI 功能未启用' : 'AI 功能未配置'}
              </Text>
              <Text style={[styles.emptyDesc, { color: tc.textMuted }]}>
                请前往设置 → AI 智能 → AI 配置，开启开关并填写 API Key。
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: tc.primary }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={[styles.emptyBtnText, { color: tc.primaryOn }]}>我知道了</Text>
              </TouchableOpacity>
            </View>
          ) : !parsed ? (
            // 输入界面
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.inputContent}
            >
              <Text style={[styles.heroTitle, { color: tc.text }]}>用一句话告诉 AI{'\n'}你刚刚花了什么</Text>
              <Text style={[styles.heroHint, { color: tc.textMuted }]}>
                例如「昨天打车 35」「今天中午吃火锅 120」
              </Text>

              <View style={[styles.inputBox, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.textInput, { color: tc.text }]}
                  value={text}
                  onChangeText={setText}
                  placeholder="试试输入：昨天打车 35"
                  placeholderTextColor={tc.textSubtle}
                  multiline
                  autoCorrect={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>

              <Text style={[styles.suggestionLabel, { color: tc.textMuted }]}>不知道怎么写？试试：</Text>
              <View style={styles.suggestionList}>
                {SUGGESTIONS.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.suggestionChip, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
                    onPress={() => setText(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestionText, { color: tc.textSecondary }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger }]}>
                  <Ionicons name="alert-circle" size={16} color={tc.danger} />
                  <Text style={[styles.errorText, { color: tc.danger }]}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>
          ) : parsedList ? (
            // 多笔预览
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.previewContent}
            >
              <Text style={[styles.previewHint, { color: tc.textMuted, textAlign: 'center', marginBottom: spacing.md, fontSize: fontSize.md, fontWeight: fontWeight.semibold }]}>
                共识别到 {parsedList.length} 笔账目
              </Text>
              {parsedList.map((item, idx) => {
                const info = categoryConfig[item.type].find((c) => c.name === item.category);
                const color = tc.categories[item.category] || tc.textMuted;
                return (
                  <View key={idx} style={[styles.previewCard, { backgroundColor: tc.surface, borderColor: tc.border, marginBottom: spacing.md, padding: spacing.lg, alignItems: 'flex-start' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: spacing.sm }}>
                      <View style={[styles.previewCat, { backgroundColor: color + '22', width: 40, height: 40, borderRadius: 12, marginRight: spacing.md, marginBottom: 0 }]}>
                        <Ionicons name={info?.icon || 'help'} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.previewType, { color: tc.textMuted, fontSize: fontSize.xs, marginBottom: 2 }]}>{item.type === 'expense' ? '支出' : '收入'}</Text>
                        <Text style={[styles.previewCategory, { color: tc.text, fontSize: fontSize.md, marginTop: 0 }]}>{item.category}</Text>
                      </View>
                      <Text style={[styles.previewAmount, { color: item.type === 'expense' ? tc.text : tc.success, fontSize: fontSize.xl, letterSpacing: -0.5, lineHeight: 28 }]}>
                        {item.type === 'expense' ? '-' : '+'}{currencySymbol}{item.amount.toFixed(2)}
                      </Text>
                    </View>
                    {(item.note || item.date) ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, width: '100%' }}>
                        {item.note ? <Text style={[styles.previewRowLabel, { color: tc.textMuted, fontSize: fontSize.xs }]}>备注：{item.note}</Text> : null}
                        {item.date ? <Text style={[styles.previewRowLabel, { color: tc.textMuted, fontSize: fontSize.xs }]}>日期：{new Date(item.date).toLocaleDateString('zh-CN')}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              <Text style={[styles.previewHint, { color: tc.textMuted }]}>
                点击「全部保存」将这 {parsedList.length} 笔账目一起保存
              </Text>
            </ScrollView>
          ) : (
            // 单笔预览界面
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.previewContent}
            >
              <View style={[styles.previewCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={[styles.previewCat, { backgroundColor: catColor + '22' }]}>
                  <Ionicons name={catInfo?.icon || 'help'} size={32} color={catColor} />
                </View>
                <Text style={[styles.previewType, { color: tc.textMuted }]}>
                  {parsed.type === 'expense' ? '支出' : '收入'}
                </Text>
                <Text style={[styles.previewAmount, { color: parsed.type === 'expense' ? tc.text : tc.success }]}>
                  {parsed.type === 'expense' ? '-' : '+'}{currencySymbol}{parsed.amount.toFixed(2)}
                </Text>
                <Text style={[styles.previewCategory, { color: catColor }]}>{parsed.category}</Text>

                <View style={[styles.previewDivider, { backgroundColor: tc.divider }]} />

                <View style={styles.previewRow}>
                  <Text style={[styles.previewRowLabel, { color: tc.textMuted }]}>日期</Text>
                  <Text style={[styles.previewRowValue, { color: tc.text }]}>
                    {new Date(parsed.date).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {parsed.note ? (
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewRowLabel, { color: tc.textMuted }]}>备注</Text>
                    <Text style={[styles.previewRowValue, { color: tc.text }]}>{parsed.note}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.previewHint, { color: tc.textMuted }]}>
                确认无误后点击保存，或返回重新输入
              </Text>
            </ScrollView>
          )}

          {/* 底部按钮 */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: tc.surface, borderTopColor: tc.divider, bottom: keyboardH }]}>
            {aiEnabled && hasApiKey && !parsed && !parsedList ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: text.trim() ? tc.primary : tc.surfaceMuted, opacity: text.trim() ? 1 : 0.5 }]}
                onPress={handleParse}
                activeOpacity={0.85}
                disabled={parsing || !text.trim()}
              >
                {parsing ? (
                  <>
                    <ActivityIndicator size="small" color={tc.primaryOn} />
                    <Text style={[styles.actionBtnText, { color: tc.primaryOn }]}>AI 解析中…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color={text.trim() ? tc.primaryOn : tc.textMuted} />
                    <Text style={[styles.actionBtnText, { color: text.trim() ? tc.primaryOn : tc.textMuted }]}>智能解析</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
            {aiEnabled && hasApiKey && (parsed || parsedList) ? (
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.reParseBtn, { backgroundColor: tc.surfaceMuted, borderColor: tc.border, borderWidth: StyleSheet.hairlineWidth }]}
                  onPress={handleReParse}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={18} color={tc.text} />
                  <Text style={[styles.actionBtnText, { color: tc.text }]}>重新输入</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.saveBtn, { backgroundColor: tc.primary, flex: 1.4 }]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={18} color={tc.primaryOn} />
                  <Text style={[styles.actionBtnText, { color: tc.primaryOn, fontWeight: fontWeight.semibold }]}>{parsedList ? '全部保存' : '保存账目'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 顶栏
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },

  // 空状态
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  emptyDesc: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  emptyBtn: {
    paddingHorizontal: spacing.xl,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  // 输入
  inputContent: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 96 },
  heroTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.6, lineHeight: 36, marginBottom: spacing.sm },
  heroHint: { fontSize: fontSize.md, lineHeight: 22, marginBottom: spacing.xl },
  inputBox: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    minHeight: 120,
    marginBottom: spacing.lg,
  },
  textInput: {
    fontSize: fontSize.lg,
    lineHeight: 26,
    minHeight: 100,
    padding: 0,
  },
  suggestionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: spacing.sm },
  suggestionList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  errorText: { fontSize: fontSize.sm, flex: 1, lineHeight: 19 },

  // 预览
  previewContent: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 96 },
  previewCard: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: 'center',
  },
  previewCat: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  previewType: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  previewAmount: { fontSize: 44, fontWeight: fontWeight.bold, letterSpacing: -1.5, lineHeight: 50, fontVariant: ['tabular-nums'] },
  previewCategory: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: spacing.xs, marginBottom: spacing.lg },
  previewDivider: { width: '100%', height: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.xs,
  },
  previewRowLabel: { fontSize: fontSize.sm },
  previewRowValue: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  previewHint: { fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },

  // 底部
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  previewActions: { flexDirection: 'row', gap: spacing.sm },
  reParseBtn: {},
  saveBtn: {},
});
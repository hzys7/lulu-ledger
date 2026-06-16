// 璐璐记账 · AI 财务问答（全屏聊天界面）
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors } from '../theme';
import { askFinanceQuestion, buildFinancialContext } from '../utils/aiQA';
import { loadAiConfig } from '../utils/aiConfig';

const QUICK_QUESTIONS = [
  '这个月花了多少钱？',
  '哪项支出最多？',
  '跟上个月比怎么样？',
  '有什么省钱建议吗？',
];

export default function AiQAScreen({ visible, onClose }) {
  const { transactions, settings, getMonthTransactions, getMonthSummary, budgets } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([]); // [{ role: 'user'|'assistant', content: string }]
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contextText, setContextText] = useState('');
  const [aiReady, setAiReady] = useState(true);

  // 构建财务上下文
  useEffect(() => {
    if (!visible) return;
    (async () => {
      const cfg = await loadAiConfig();
      if (!cfg.enabled || !cfg.apiKey) {
        setAiReady(false);
        return;
      }
      setAiReady(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const currentTxs = getMonthTransactions(year, month);
      const summary = getMonthSummary(year, month);

      // 上月
      const lastMonth = month === 0 ? 11 : month - 1;
      const lastYear = month === 0 ? year - 1 : year;
      const lastSummary = getMonthSummary(lastYear, lastMonth);

      const ctx = buildFinancialContext({
        transactions: currentTxs,
        summary,
        lastSummary,
        currency: settings.currency,
        budgets: budgets?.filter((b) => b.month === `${year}-${String(month + 1).padStart(2, '0')}`) || [],
      });
      setContextText(ctx);
    })();
  }, [visible]);

  // 重置状态
  useEffect(() => {
    if (visible) {
      setMessages([]);
      setInput('');
      setError('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [visible]);

  function scrollToBottom() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function handleSend(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setError('');
    const userMsg = { role: 'user', content: msg };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);
    scrollToBottom();

    // 构建对话历史（不含 system）
    const history = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await askFinanceQuestion({
      userMessage: msg,
      history: history.slice(0, -1), // 不含当前消息（askFinanceQuestion 会加）
      contextText,
    });

    setLoading(false);
    if (res.ok) {
      setMessages([...updatedMessages, { role: 'assistant', content: res.reply }]);
    } else {
      setError(res.error);
    }
    scrollToBottom();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: tc.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* 顶栏 */}
          <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: tc.divider, backgroundColor: tc.surface }]}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={[styles.titleIcon]}>💬</Text>
              <Text style={[styles.topTitle, { color: tc.text }]}>问问小璐</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {!aiReady ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🤖</Text>
              <Text style={[styles.emptyTitle, { color: tc.text }]}>AI 功能未就绪</Text>
              <Text style={[styles.emptyDesc, { color: tc.textMuted }]}>
                请前往设置 → AI 配置，开启开关并填写 API Key。
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: tc.primary }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={[styles.emptyBtnText, { color: tc.primaryOn }]}>我知道了</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* 聊天区域 */}
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={[styles.chatContent, { paddingBottom: messages.length === 0 ? spacing.xl : spacing.md }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <View style={styles.welcomeWrap}>
                    <Text style={[styles.welcomeEmoji]}>🤖</Text>
                    <Text style={[styles.welcomeTitle, { color: tc.text }]}>你好，我是小璐</Text>
                    <Text style={[styles.welcomeDesc, { color: tc.textMuted }]}>
                      可以问我关于你账目的任何问题
                    </Text>
                    <View style={styles.quickList}>
                      {QUICK_QUESTIONS.map((q, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.quickChip, { backgroundColor: tc.surface, borderColor: tc.border }]}
                          onPress={() => handleSend(q)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.quickText, { color: tc.text }]}>{q}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  messages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    return (
                      <View
                        key={i}
                        style={[
                          styles.msgRow,
                          isUser ? styles.msgRowUser : styles.msgRowBot,
                        ]}
                      >
                        {!isUser && (
                          <View style={[styles.avatar, { backgroundColor: tc.primary + '22' }]}>
                            <Text style={styles.avatarText}>🤖</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.bubble,
                            {
                              backgroundColor: isUser ? tc.primary : tc.surface,
                              borderColor: isUser ? tc.primary : tc.border,
                              borderWidth: isUser ? 0 : StyleSheet.hairlineWidth,
                            },
                          ]}
                        >
                          <Text style={[styles.bubbleText, { color: isUser ? tc.primaryOn : tc.text }]}>
                            {msg.content}
                          </Text>
                        </View>
                        {isUser && (
                          <View style={[styles.avatar, { backgroundColor: tc.surfaceMuted }]}>
                            <Ionicons name="person" size={16} color={tc.textMuted} />
                          </View>
                        )}
                      </View>
                    );
                  })
                )}

                {loading && (
                  <View style={[styles.msgRow, styles.msgRowBot]}>
                    <View style={[styles.avatar, { backgroundColor: tc.primary + '22' }]}>
                      <Text style={styles.avatarText}>🤖</Text>
                    </View>
                    <View style={[styles.bubble, { backgroundColor: tc.surface, borderColor: tc.border, borderWidth: StyleSheet.hairlineWidth }]}>
                      <ActivityIndicator size="small" color={tc.primary} />
                    </View>
                  </View>
                )}

                {error ? (
                  <View style={[styles.errorRow, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger }]}>
                    <Ionicons name="alert-circle" size={14} color={tc.danger} />
                    <Text style={[styles.errorText, { color: tc.danger }]}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* 输入栏 */}
              <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: tc.surface, borderTopColor: tc.divider }]}>
                <View style={[styles.inputWrap, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.textInput, { color: tc.text }]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="问我任何关于账目的问题..."
                    placeholderTextColor={tc.textSubtle}
                    returnKeyType="send"
                    onSubmitEditing={() => handleSend()}
                    autoCorrect={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={300}
                  />
                  <TouchableOpacity
                    onPress={() => handleSend()}
                    disabled={loading || !input.trim()}
                    style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? tc.primary : tc.surfaceMuted }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-up" size={18} color={input.trim() && !loading ? tc.primaryOn : tc.textSubtle} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
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
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  titleIcon: { fontSize: fontSize.md },
  topTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },

  // 空状态
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  emptyDesc: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },
  emptyBtn: { paddingHorizontal: spacing.xl, height: 46, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  // 聊天
  chatContent: { paddingHorizontal: spacing.base, paddingTop: spacing.md },

  // 欢迎
  welcomeWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  welcomeEmoji: { fontSize: 56, marginBottom: spacing.md },
  welcomeTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  welcomeDesc: { fontSize: fontSize.md, color: undefined, marginBottom: spacing.xl },
  quickList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // 消息气泡
  msgRow: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-start' },
  msgRowBot: { justifyContent: 'flex-start', gap: spacing.sm },
  msgRowUser: { justifyContent: 'flex-end', gap: spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: { fontSize: fontSize.sm },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bubbleText: { fontSize: fontSize.md, lineHeight: 22 },

  // 错误
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  errorText: { fontSize: fontSize.xs, flex: 1 },

  // 输入栏
  inputBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.md,
    height: 44,
    gap: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.md,
    padding: 0,
    height: 44,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
});

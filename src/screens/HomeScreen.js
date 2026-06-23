// 小璐记账 · 首页（仪表盘）
// v1.5.2 重新设计：顶部问候 → 轻量账本切换 → 净资产 → 账户 → AI
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney } from '../utils/currency';
import { loadAiConfig } from '../utils/aiConfig';
import { typeInfo } from '../utils/accountTypes';
import VoiceRecordModal from '../components/VoiceRecordModal';
import AiQAScreen from './AiQAScreen';
import AnomalyAlert from '../components/AnomalyAlert';
import { detectAnomalies, generateAnomalyMessage, getCachedAnomalies, setCachedAnomalies } from '../utils/aiAnomaly';
import BookModal from './settings/BookModal';
import { spacing, borderRadius, fontSize, fontWeight, shadows, getThemeColors } from '../theme';

// ─── 问候语 ────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return { text: '夜深了',   emoji: '🌙' };
  if (h < 9)  return { text: '早上好',   emoji: '☀️' };
  if (h < 12) return { text: '上午好',   emoji: '☀️' };
  if (h < 14) return { text: '中午好',   emoji: '☀️' };
  if (h < 18) return { text: '下午好',   emoji: '🌤' };
  if (h < 21) return { text: '晚上好',   emoji: '🌆' };
  return { text: '晚安',     emoji: '🌙' };
}

function fmtDate() {
  const d = new Date();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = weekDays[d.getDay()];
  return `${m}月${day}日 ${wd}`;
}

// ─── 主组件 ────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { settings, reload, getNetWorth, books, currentBookId, switchBook, createBook, editBook, removeBook, accounts, transactions, getMonthSummary } = useFinance();
  const tc = useMemo(() => getThemeColors(settings.theme), [settings.theme]);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [newBookName, setNewBookName] = useState('');
  const [newBookIcon, setNewBookIcon] = useState('wallet');
  const [newBookColor, setNewBookColor] = useState('#7C5CFF');
  const netWorth = getNetWorth();

  // 今日支出
  const todayExpense = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d >= todayStart && t.type === 'expense';
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // AI
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showVoiceRecord, setShowVoiceRecord] = useState(false);
  const [showAiQA, setShowAiQA] = useState(false);
  const [anomalyAlert, setAnomalyAlert] = useState(null);
  const [anomalyDismissed, setAnomalyDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const refreshAi = async () => {
        const cfg = await loadAiConfig();
        if (alive) setAiEnabled(!!(cfg.enabled && cfg.apiKey));
      };
      refreshAi();
      return () => { alive = false; };
    }, []),
  );

  const anomalyTxCount = transactions.length;
  useEffect(() => {
    if (anomalyTxCount <= 5 || anomalyDismissed) { setAnomalyAlert(null); return; }
    let alive = true;
    (async () => {
      const cached = await getCachedAnomalies(anomalyTxCount);
      if (cached && cached.anomalies?.length > 0) { if (alive) setAnomalyAlert(cached); return; }
      const anomalies = detectAnomalies({ transactions, getMonthSummary });
      if (anomalies.length > 0) {
        const res = await generateAnomalyMessage(anomalies);
        if (alive && res.ok && res.message) {
          setAnomalyAlert({ message: res.message, anomalies });
          setCachedAnomalies(anomalies, res.message, anomalyTxCount);
        }
      } else { if (alive) setAnomalyAlert(null); }
    })();
    return () => { alive = false; };
  }, [anomalyTxCount, anomalyDismissed]);

  // 账本切换时重置异常提醒状态
  useEffect(() => {
    setAnomalyDismissed(false);
    setAnomalyAlert(null);
  }, [currentBookId]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await reload(); setRefreshing(false); }, [reload]);

  const currentBook = books.find(b => b.id === currentBookId) || books[0];
  const greeting = getGreeting();

  const openAddBook = () => {
    setEditingBook(null); setNewBookName(''); setNewBookIcon('wallet'); setNewBookColor('#7C5CFF');
    setShowBookModal(true);
  };
  const openEditBook = (book) => {
    setEditingBook(book); setNewBookName(book.name); setNewBookIcon(book.icon); setNewBookColor(book.color);
    setShowBookModal(true);
  };
  const handleSaveBook = async () => {
    if (!newBookName.trim()) { Alert.alert('提示', '请输入账本名称'); return; }
    if (editingBook) {
      await editBook(editingBook.id, { name: newBookName, icon: newBookIcon, color: newBookColor });
    } else {
      await createBook({ id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name: newBookName, icon: newBookIcon, color: newBookColor, currency: settings.currency, createdAt: new Date().toISOString() });
    }
    setShowBookModal(false);
  };
  const handleDeleteBook = (book) => {
    if (books.length <= 1) { Alert.alert('提示', '至少需要保留一个账本'); return; }
    Alert.alert('删除账本', `确定删除「${book.name}」吗？该账本下的所有记录也会被删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeBook(book.id) },
    ]);
  };

  // ─── 渲染 ─────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.text} />}
      >
        {/* ─── 问候 + 今日支出 + 账本切换 ──────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: tc.text }]}>
              {greeting.text}{'  '}<Text style={styles.greetingEmoji}>{greeting.emoji}</Text>
            </Text>
            <Text style={[styles.dateText, { color: tc.textMuted }]}>{fmtDate()}</Text>
            {todayExpense > 0 ? (
              <View style={styles.todayRow}>
                <Text style={[styles.todayLabel, { color: tc.textSubtle }]}>今日支出</Text>
                <Text style={[styles.todayAmount, { color: tc.primary }]}>
                  -{formatMoney(todayExpense, settings.currency).replace(/[^0-9.,]/g, '')}
                </Text>
              </View>
            ) : (
              <Text style={[styles.todayNoop, { color: tc.textSubtle }]}>今天还没有记帐</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.bookChip, { backgroundColor: tc.primarySubtle }]}
            onPress={() => setBookPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name={currentBook?.icon || 'wallet'} size={14} color={currentBook?.color || tc.primary} />
            <Text style={[styles.bookChipText, { color: tc.textSecondary }]} numberOfLines={1}>
              {currentBook?.name || '日常账本'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={tc.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ─── 净资产 ────────────────────────────────── */}
        <View style={styles.netWorthArea}>
          {accounts.length === 0 ? (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: tc.surface }]}
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
            >
              <View style={styles.netWorthEmptyRow}>
                <View style={[styles.netWorthEmptyIcon, { backgroundColor: tc.primarySubtle }]}>
                  <Ionicons name="wallet-outline" size={22} color={tc.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.netWorthLabel, { color: tc.textMuted }]}>净资产</Text>
                  <Text style={[styles.netWorthEmptyTitle, { color: tc.text }]}>还没有账户</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: tc.surface }]}
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
            >
              <Text style={[styles.netWorthLabel, { color: tc.textMuted }]}>净资产</Text>
              <Text style={[styles.netWorthAmount, { color: tc.text }]}>
                {formatMoney(netWorth, settings.currency)}
              </Text>
              <View style={styles.netWorthMeta}>
                <Text style={[styles.netWorthHint, { color: tc.textSubtle }]}>
                  {accounts.length} 个账户
                </Text>
                <Ionicons name="chevron-forward" size={14} color={tc.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── AI 助手 ───────────────────────────────── */}
        {aiEnabled ? (
          <View style={styles.section}>
            <View style={[styles.card, styles.aiCard]}>
              <View style={styles.aiCardLeft}>
                <View style={[styles.aiIconWarp, { backgroundColor: tc.accentSubtle }]}>
                  <Ionicons name="sparkles" size={18} color={tc.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiTitle, { color: tc.text }]}>AI 助手</Text>
                  <Text style={[styles.aiHint, { color: tc.textMuted }]}>语音记账 · 问答分析</Text>
                </View>
              </View>
              <View style={styles.aiBtns}>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: tc.primary }]}
                  onPress={() => setShowVoiceRecord(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mic" size={14} color={tc.primaryOn} />
                  <Text style={[styles.aiBtnText, { color: tc.primaryOn }]}>语音记</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: tc.accent }]}
                  onPress={() => setShowAiQA(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles" size={14} color="#fff" />
                  <Text style={[styles.aiBtnText, { color: '#fff' }]}>问问</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* ─── 异常提醒 ──────────────────────────────── */}
        {aiEnabled && anomalyAlert && !anomalyDismissed ? (
          <View style={styles.anomalyArea}>
            <AnomalyAlert
              message={anomalyAlert.message}
              anomalies={anomalyAlert.anomalies}
              tc={tc}
              onDismiss={() => setAnomalyDismissed(true)}
            />
          </View>
        ) : null}

        {/* ─── 资金账户 ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>资金账户</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NetWorth')} activeOpacity={0.7} style={styles.sectionAction}>
              <Text style={[styles.sectionActionText, { color: tc.primary }]}>管理</Text>
              <Ionicons name="chevron-forward" size={13} color={tc.primary} />
            </TouchableOpacity>
          </View>

          {accounts.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Ionicons name="wallet-outline" size={32} color={tc.textSubtle} />
              <Text style={[styles.emptyText, { color: tc.textMuted }]}>还没有账户</Text>
              <Text style={[styles.emptyHint, { color: tc.textSubtle }]}>添加微信/支付宝/银行卡</Text>
            </View>
          ) : (
            <View style={[styles.card, styles.accountList]}>
              {accounts.map((acc, i) => {
                const meta = typeInfo(acc.type);
                const isLast = i === accounts.length - 1;
                return (
                  <View key={acc.id} style={[styles.accountRow, !isLast && { borderBottomColor: tc.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <View style={[styles.accountIcon, { backgroundColor: (acc.color || meta.color) + '1A' }]}>
                      <Ionicons name={acc.icon || meta.icon} size={17} color={acc.color || meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountName, { color: tc.text }]} numberOfLines={1}>{acc.name}</Text>
                      <Text style={[styles.accountType, { color: tc.textSubtle }]}>{meta.name}</Text>
                    </View>
                    <Text style={[styles.accountBalance, { color: tc.text }]}>
                      {formatMoney(acc.balance, settings.currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ─── AI 助手 ───────────────────────────────── */}
        {aiEnabled ? (
          <View style={styles.section}>
            <View style={[styles.card, styles.aiCard]}>
              <View style={styles.aiCardLeft}>
                <View style={[styles.aiIconWarp, { backgroundColor: tc.accentSubtle }]}>
                  <Ionicons name="sparkles" size={18} color={tc.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiTitle, { color: tc.text }]}>AI 助手</Text>
                  <Text style={[styles.aiHint, { color: tc.textMuted }]}>语音记账 · 问答分析</Text>
                </View>
              </View>
              <View style={styles.aiBtns}>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: tc.primary }]}
                  onPress={() => setShowVoiceRecord(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mic" size={14} color={tc.primaryOn} />
                  <Text style={[styles.aiBtnText, { color: tc.primaryOn }]}>语音记</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: tc.accent }]}
                  onPress={() => setShowAiQA(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles" size={14} color="#fff" />
                  <Text style={[styles.aiBtnText, { color: '#fff' }]}>问问</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

      </ScrollView>

      <VoiceRecordModal visible={showVoiceRecord} onClose={() => setShowVoiceRecord(false)} onSaved={() => { setShowVoiceRecord(false); reload(); }} />
      <AiQAScreen visible={showAiQA} onClose={() => setShowAiQA(false)} />

      {/* 账本选择弹窗 */}
      <Modal visible={bookPickerOpen} transparent animationType="fade" onRequestClose={() => setBookPickerOpen(false)}>
        <Pressable style={styles.bookModalBackdrop} onPress={() => setBookPickerOpen(false)}>
          <Pressable style={[styles.bookModalSheet, { backgroundColor: tc.surface }]} onPress={() => {}}>
            <View style={[styles.bookModalHandle, { backgroundColor: tc.divider }]} />
            <Text style={[styles.bookModalTitle, { color: tc.text }]}>选择账本</Text>
            {books.map((book) => {
              const active = book.id === currentBookId;
              return (
                <TouchableOpacity key={book.id} style={[styles.bookModalItem, { borderBottomColor: tc.divider }]} onPress={() => { switchBook(book.id); setBookPickerOpen(false); }} onLongPress={() => { setBookPickerOpen(false); openEditBook(book); }} activeOpacity={0.7}>
                  <View style={[styles.bookModalIcon, { backgroundColor: book.color + '22' }]}>
                    <Ionicons name={book.icon} size={16} color={book.color} />
                  </View>
                  <Text style={[styles.bookModalItemText, { color: active ? tc.primary : tc.text }]}>{book.name}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.bookModalAdd, { borderTopColor: tc.divider }]} onPress={() => { setBookPickerOpen(false); openAddBook(); }} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={tc.primary} />
              <Text style={[styles.bookModalAddText, { color: tc.primary }]}>新建账本</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <BookModal visible={showBookModal} onClose={() => setShowBookModal(false)} editingBook={editingBook} newBookName={newBookName} setNewBookName={setNewBookName} newBookIcon={newBookIcon} setNewBookIcon={setNewBookIcon} newBookColor={newBookColor} setNewBookColor={setNewBookColor} onSave={handleSaveBook} onDelete={() => { setShowBookModal(false); handleDeleteBook(editingBook); }} />
    </View>
  );
}

// ─── 样式 ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 顶部
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greetingEmoji: {
    fontSize: fontSize.xl,
  },
  dateText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
    marginBottom: spacing.sm,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  todayAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  todayNoop: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  bookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 5,
    marginTop: 4,
  },
  bookChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    maxWidth: 90,
  },

  // 净资产
  netWorthArea: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.base + 2,
    ...shadows.sm,
  },
  netWorthLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  netWorthAmount: {
    fontSize: 34,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 8,
  },
  netWorthMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netWorthHint: {
    fontSize: fontSize.xs,
  },
  netWorthEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  netWorthEmptyIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  netWorthEmptyTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2,
    marginTop: 2,
  },

  // section
  section: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  sectionAction: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  sectionActionText: {
    fontSize: fontSize.sm, fontWeight: fontWeight.medium,
  },

  // 异常区域
  anomalyArea: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },

  // 账户列表
  accountList: {
    padding: 0,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md, gap: spacing.md,
  },
  accountIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  accountName: {
    fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.1,
    marginBottom: 2,
  },
  accountType: {
    fontSize: fontSize.xs,
  },
  accountBalance: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  // 空状态
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl + spacing.sm,
    gap: 6,
  },
  emptyText: {
    fontSize: fontSize.md, fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
  },
  emptyHint: {
    fontSize: fontSize.xs,
  },

  // AI 卡片
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  aiCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiIconWarp: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  aiTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    marginBottom: 1, letterSpacing: -0.2,
  },
  aiHint: {
    fontSize: fontSize.xs, lineHeight: 16,
  },
  aiBtns: {
    flexDirection: 'row', gap: spacing.sm,
  },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: borderRadius.full, gap: 4,
  },
  aiBtnText: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
  },

  // 账本弹窗（不动）
  bookModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bookModalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base, borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
  },
  bookModalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  bookModalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: spacing.sm, letterSpacing: -0.3 },
  bookModalItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.base, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.md,
  },
  bookModalIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bookModalItemText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, flex: 1, letterSpacing: -0.2 },
  bookModalAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingTop: spacing.base, marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth,
  },
  bookModalAddText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
});

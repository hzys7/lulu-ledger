// 璐璐记账 · 首页（仪表盘）
// 设计：大号余额卡 + 快捷统计 + 近期交易 + AI 入口
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { TransactionItem, EmptyState } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import { loadAiConfig } from '../utils/aiConfig';
import AiChatScreen from './AiChatScreen';
import AiQAScreen from './AiQAScreen';
import AnomalyAlert from '../components/AnomalyAlert';
import { detectAnomalies, generateAnomalyMessage, getCachedAnomalies, setCachedAnomalies } from '../utils/aiAnomaly';
import BookModal from './settings/BookModal';
import { spacing, borderRadius, fontSize, fontWeight, shadows, getThemeColors } from '../theme';

export default function HomeScreen({ navigation }) {
  const { transactions, settings, getMonthSummary, reload, getNetWorth, books, currentBookId, switchBook, createBook, editBook, removeBook } = useFinance();
  const tc = useMemo(() => getThemeColors(settings.theme), [settings.theme]);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [newBookName, setNewBookName] = useState('');
  const [newBookIcon, setNewBookIcon] = useState('wallet');
  const [newBookColor, setNewBookColor] = useState('#7C5CFF');

  const now = new Date();
  const summary = getMonthSummary(now.getFullYear(), now.getMonth());
  const netWorth = getNetWorth();

  // AI 配置
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showAiQA, setShowAiQA] = useState(false);
  // 异常消费提醒
  const [anomalyAlert, setAnomalyAlert] = useState(null); // { message, anomalies }
  const [anomalyDismissed, setAnomalyDismissed] = useState(false);
  const focusCheckRef = useRef(false);
  // Effect 1: AI 配置刷新（挂载 + 页面聚焦时检查）
  useEffect(() => {
    let alive = true;
    const refreshAi = async () => {
      const cfg = await loadAiConfig();
      if (alive) setAiEnabled(!!(cfg.enabled && cfg.apiKey));
    };
    refreshAi();
    if (!focusCheckRef.current) {
      focusCheckRef.current = true;
      const unsub = navigation.addListener('focus', refreshAi);
      return () => { alive = false; unsub(); };
    }
    return () => { alive = false; };
  }, [navigation]);

  // Effect 2: 异常消费检测（交易变化时检查，有 6 小时缓存）
  const anomalyTxCount = transactions.length;
  useEffect(() => {
    if (anomalyTxCount <= 5 || anomalyDismissed) {
      setAnomalyAlert(null);
      return;
    }
    let alive = true;
    (async () => {
      const cached = await getCachedAnomalies();
      if (cached && cached.anomalies?.length > 0) {
        if (alive) setAnomalyAlert(cached);
        return;
      }
      const anomalies = detectAnomalies({ transactions, getMonthSummary });
      if (anomalies.length > 0) {
        const res = await generateAnomalyMessage(anomalies);
        if (alive && res.ok && res.message) {
          const data = { message: res.message, anomalies };
          setAnomalyAlert(data);
          setCachedAnomalies(anomalies, res.message);
        }
      } else {
        if (alive) setAnomalyAlert(null);
      }
    })();
    return () => { alive = false; };
  }, [anomalyTxCount, anomalyDismissed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // 上月对照
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastSummary = getMonthSummary(lastMonthYear, lastMonth);
  const expenseDiff = summary.expense - lastSummary.expense;
  const expenseDiffPct = lastSummary.expense > 0 ? Math.round((expenseDiff / lastSummary.expense) * 100) : 0;

  const currentBook = books.find(b => b.id === currentBookId) || books[0];

  const openAddBook = () => {
    setEditingBook(null);
    setNewBookName('');
    setNewBookIcon('wallet');
    setNewBookColor('#7C5CFF');
    setShowBookModal(true);
  };
  const openEditBook = (book) => {
    setEditingBook(book);
    setNewBookName(book.name);
    setNewBookIcon(book.icon);
    setNewBookColor(book.color);
    setShowBookModal(true);
  };
  const handleSaveBook = async () => {
    if (!newBookName.trim()) {
      Alert.alert('提示', '请输入账本名称');
      return;
    }
    if (editingBook) {
      await editBook(editingBook.id, { name: newBookName, icon: newBookIcon, color: newBookColor });
    } else {
      await createBook({
        id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newBookName,
        icon: newBookIcon,
        color: newBookColor,
        currency: settings.currency,
        createdAt: new Date().toISOString(),
      });
    }
    setShowBookModal(false);
  };
  const handleDeleteBook = (book) => {
    if (books.length <= 1) {
      Alert.alert('提示', '至少需要保留一个账本');
      return;
    }
    Alert.alert('删除账本', `确定删除「${book.name}」吗？该账本下的所有记录也会被删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeBook(book.id) },
    ]);
  };

  const [txFilter, setTxFilter] = useState('all'); // all | income | expense

  // 近期交易（最近 5 笔，可筛选收支类型）
  const recentTransactions = useMemo(() => {
    let list = [...transactions];
    if (txFilter === 'income') list = list.filter((t) => t.type === 'income');
    if (txFilter === 'expense') list = list.filter((t) => t.type === 'expense');
    return list
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
      })
      .slice(0, 5);
  }, [transactions, txFilter]);

  const hasData = transactions.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.text} />}
      >
        {/* 顶部账本选择器 */}
        <View style={styles.bookHeader}>
          <TouchableOpacity
            style={[styles.bookSelector, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={() => setBookPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name={currentBook?.icon || 'wallet'} size={16} color={currentBook?.color || tc.primary} />
            <Text style={[styles.bookSelectorText, { color: tc.text }]} numberOfLines={1}>
              {currentBook?.name || '默认账本'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={tc.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openAddBook}
            style={[styles.bookAddBtn, { backgroundColor: tc.surfaceMuted }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={18} color={tc.text} />
          </TouchableOpacity>
        </View>

        {/* 余额卡片 */}
        <View style={styles.balanceSection}>
          <View style={[styles.balanceCard, { backgroundColor: tc.surface, borderColor: tc.border, borderWidth: StyleSheet.hairlineWidth, ...shadows.sm }]}>
            <View style={styles.balanceBlock}>
              <Text style={[styles.balanceLabel, { color: tc.textMuted }]}>本月收支</Text>
              <Text style={[styles.balanceAmount, { color: summary.balance >= 0 ? tc.text : tc.danger }]}>
                {formatMoney(summary.balance, settings.currency)}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('NetWorth')}
                activeOpacity={0.6}
                style={styles.netWorthRow}
              >
                <Text style={[styles.netWorthLabel, { color: tc.textMuted }]}>净资产</Text>
                <Text style={[styles.netWorthValue, { color: netWorth >= 0 ? tc.text : tc.danger }]} numberOfLines={1}>
                  {formatMoney(netWorth, settings.currency)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={tc.textSubtle} />
              </TouchableOpacity>
            </View>
            <View style={[styles.statDivider, { backgroundColor: tc.divider }]} />
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <View style={styles.statMeta}>
                  <View style={[styles.statArrow, { backgroundColor: tc.successSubtle }]}>
                    <Ionicons name="arrow-down" size={10} color={tc.success} />
                  </View>
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>收入</Text>
                </View>
                <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(summary.income, settings.currency)}</Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statMeta}>
                  <View style={[styles.statArrow, { backgroundColor: tc.dangerSubtle }]}>
                    <Ionicons name="arrow-up" size={10} color={tc.danger} />
                  </View>
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>支出</Text>
                </View>
                <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(summary.expense, settings.currency)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 快捷统计 */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
            <Text style={[styles.statCardLabel, { color: tc.textMuted }]}>本月支出</Text>
            <View style={styles.statCardRow}>
              <Text style={[styles.statCardValue, { color: tc.text }]}>
                -{formatMoney(summary.expense, settings.currency)}
              </Text>
              <View style={[styles.diffBadge, { backgroundColor: expenseDiff > 0 ? tc.dangerSubtle : tc.successSubtle }]}>
                <Ionicons
                  name={expenseDiff > 0 ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={expenseDiff > 0 ? tc.danger : tc.success}
                />
                <Text style={[styles.diffText, { color: expenseDiff > 0 ? tc.danger : tc.success }]}>
                  {expenseDiffPct > 0 ? '+' : ''}{expenseDiffPct}%
                </Text>
              </View>
            </View>
            <Text style={[styles.statCardSub, { color: tc.textSubtle }]}>vs 上月</Text>
          </View>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={() => navigation.navigate('Statistics')}
            activeOpacity={0.7}
          >
            <Text style={[styles.statCardLabel, { color: tc.textMuted }]}>日均支出</Text>
            <Text style={[styles.statCardValue, { color: tc.text }]}>
              -{formatMoney(now.getDate() > 0 ? summary.expense / now.getDate() : 0, settings.currency)}
            </Text>
            <View style={styles.statCardFooter}>
              <Text style={[styles.statCardSub, { color: tc.primary }]}>查看统计 →</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 异常消费提醒 */}
        {aiEnabled && anomalyAlert && !anomalyDismissed ? (
          <View style={{ paddingHorizontal: spacing.base }}>
            <AnomalyAlert
              message={anomalyAlert.message}
              anomalies={anomalyAlert.anomalies}
              tc={tc}
              onDismiss={() => setAnomalyDismissed(true)}
            />
          </View>
        ) : null}

        {/* AI 智能（仅启用时显示） */}
        {aiEnabled ? (
          <View style={styles.aiCardWrap}>
            <View style={[styles.aiCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.aiCardLeft}>
                <Text style={styles.aiCardEmoji}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiCardTitle, { color: tc.text }]}>AI 助手</Text>
                  <Text style={[styles.aiCardHint, { color: tc.textMuted }]}>一句话记账 · 问答分析</Text>
                </View>
              </View>
              <View style={styles.aiCardBtns}>
                <TouchableOpacity
                  style={[styles.aiCardBtn, { backgroundColor: tc.primary }]}
                  onPress={() => setShowAiChat(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles" size={16} color={tc.primaryOn} />
                  <Text style={[styles.aiCardBtnText, { color: tc.primaryOn }]}>记账</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiCardBtn, { backgroundColor: tc.accent }]}
                  onPress={() => setShowAiQA(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles" size={16} color="#fff" />
                  <Text style={[styles.aiCardBtnText, { color: '#fff' }]}>问问</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* 近期交易 */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: tc.text }]}>近期交易</Text>
            {hasData ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('Records')}
                activeOpacity={0.7}
                style={styles.recentViewAll}
              >
                <Text style={[styles.recentViewAllText, { color: tc.primary }]}>查看全部</Text>
                <Ionicons name="chevron-forward" size={14} color={tc.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {/* 收支筛选 */}
          {hasData ? (
            <View style={styles.filterRow}>
              {['all', 'expense', 'income'].map((f) => {
                const active = txFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterChip,
                      { backgroundColor: tc.surfaceMuted, borderColor: tc.divider },
                      active && { backgroundColor: tc.primary, borderColor: tc.primary },
                    ]}
                    onPress={() => setTxFilter(f)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: tc.textSecondary },
                        active && { color: tc.primaryOn, fontWeight: fontWeight.semibold },
                      ]}
                    >
                      {f === 'all' ? '全部' : f === 'expense' ? '支出' : '收入'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {hasData ? (
            <View style={[styles.recentList, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              {recentTransactions.map((tx, i) => (
                <TouchableOpacity
                  key={tx.id}
                  onPress={() => navigation.navigate('AddTransaction', { transaction: tx })}
                  activeOpacity={0.7}
                >
                  <TransactionItem
                    transaction={tx}
                    currency={settings.currency}
                    isLast={i === recentTransactions.length - 1}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.recentList, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <EmptyState
                icon="receipt-outline"
                title="还没有记账记录"
                subtitle="点击右上角 + 按钮开始记账第一笔"
              />
            </View>
          )}
        </View>
      </ScrollView>

      <AiChatScreen
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSaved={() => { setShowAiChat(false); reload(); }}
      />

      <AiQAScreen
        visible={showAiQA}
        onClose={() => setShowAiQA(false)}
      />

      {/* 账本选择弹窗 */}
      <Modal visible={bookPickerOpen} transparent animationType="fade" onRequestClose={() => setBookPickerOpen(false)}>
        <Pressable style={styles.bookModalBackdrop} onPress={() => setBookPickerOpen(false)}>
          <Pressable style={[styles.bookModalSheet, { backgroundColor: tc.surface, borderColor: tc.border }]} onPress={() => {}}>
            <View style={[styles.bookModalHandle, { backgroundColor: tc.divider }]} />
            <Text style={[styles.bookModalTitle, { color: tc.text }]}>选择账本</Text>
            {books.map((book) => {
              const active = book.id === currentBookId;
              return (
                <TouchableOpacity
                  key={book.id}
                  style={[styles.bookModalItem, { borderBottomColor: tc.divider }]}
                  onPress={() => { switchBook(book.id); setBookPickerOpen(false); }}
                  onLongPress={() => { setBookPickerOpen(false); openEditBook(book); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.bookModalIcon, { backgroundColor: book.color + '22' }]}>
                    <Ionicons name={book.icon} size={16} color={book.color} />
                  </View>
                  <Text style={[styles.bookModalItemText, { color: active ? tc.primary : tc.text }]}>
                    {book.name}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.bookModalAdd, { borderTopColor: tc.divider }]}
              onPress={() => { setBookPickerOpen(false); openAddBook(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color={tc.primary} />
              <Text style={[styles.bookModalAddText, { color: tc.primary }]}>新建账本</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <BookModal
        visible={showBookModal}
        onClose={() => setShowBookModal(false)}
        editingBook={editingBook}
        newBookName={newBookName}
        setNewBookName={setNewBookName}
        newBookIcon={newBookIcon}
        setNewBookIcon={setNewBookIcon}
        newBookColor={newBookColor}
        setNewBookColor={setNewBookColor}
        onSave={handleSaveBook}
        onDelete={() => { setShowBookModal(false); handleDeleteBook(editingBook); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // 余额卡
  balanceSection: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  balanceCard: { borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.base },
  balanceBlock: { marginTop: spacing.lg },
  balanceLabel: { fontSize: fontSize.sm, letterSpacing: -0.1 },
  balanceAmount: { fontSize: 44, fontWeight: fontWeight.bold, letterSpacing: -1.5, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  netWorthRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  netWorthLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  netWorthValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  statDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.base },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1 },
  statMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statArrow: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: spacing.xxs, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },

  // 快捷统计行
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.base, paddingBottom: spacing.sm, gap: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.base, borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth, ...shadows.sm,
  },
  statCardLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  statCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  statCardValue: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  diffBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  diffText: { fontSize: 10, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  statCardSub: { fontSize: fontSize.xs, marginTop: spacing.xxs, letterSpacing: -0.1 },
  statCardFooter: { flexDirection: 'row', marginTop: spacing.xs },

  // AI 卡片
  aiCardWrap: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  aiCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, ...shadows.sm,
  },
  aiCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiCardEmoji: { fontSize: 32 },
  aiCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 2, letterSpacing: -0.2 },
  aiCardHint: { fontSize: fontSize.xs, lineHeight: 16 },
  aiCardBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.full, gap: 4 },
  aiCardBtns: { flexDirection: 'row', gap: spacing.sm },
  aiCardBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // 近期交易
  recentSection: { paddingHorizontal: spacing.base, paddingBottom: spacing.lg },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm },
  recentTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  recentViewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  recentViewAllText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: StyleSheet.hairlineWidth },
  filterChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, letterSpacing: -0.1 },
  recentList: { borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', ...shadows.sm },

  // 账本选择器
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  bookSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    flex: 1,
  },
  bookSelectorText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
    flex: 1,
  },
  bookAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 账本选择弹窗
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

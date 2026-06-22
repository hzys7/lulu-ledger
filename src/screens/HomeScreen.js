// 小璐记账 · 首页（仪表盘）
// 设计：净资产 + 资金账户 + AI 入口
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney } from '../utils/currency';
import { loadAiConfig } from '../utils/aiConfig';
import { ACCOUNT_TYPES, typeInfo } from '../utils/accountTypes';
import VoiceRecordModal from '../components/VoiceRecordModal';
import AiQAScreen from './AiQAScreen';
import AnomalyAlert from '../components/AnomalyAlert';
import { detectAnomalies, generateAnomalyMessage, getCachedAnomalies, setCachedAnomalies } from '../utils/aiAnomaly';
import BookModal from './settings/BookModal';
import { spacing, borderRadius, fontSize, fontWeight, shadows, getThemeColors } from '../theme';

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
  const now = new Date();
  const netWorth = getNetWorth();

  // AI 配置
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showVoiceRecord, setShowVoiceRecord] = useState(false);
  const [showAiQA, setShowAiQA] = useState(false);
  // 异常消费提醒
  const [anomalyAlert, setAnomalyAlert] = useState(null); // { message, anomalies }
  const [anomalyDismissed, setAnomalyDismissed] = useState(false);
  // Effect 1: AI 配置刷新（使用 useFocusEffect，每次聚焦 + 首次挂载时执行）
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

  // Effect 2: 异常消费检测（交易变化时检查，有 6 小时缓存）
  const anomalyTxCount = transactions.length;
  useEffect(() => {
    if (anomalyTxCount <= 5 || anomalyDismissed) {
      setAnomalyAlert(null);
      return;
    }
    let alive = true;
    (async () => {
      const cached = await getCachedAnomalies(anomalyTxCount);
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
          setCachedAnomalies(anomalies, res.message, anomalyTxCount);
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

        {/* 净资产 */}
        {accounts.length === 0 ? (
          <View style={styles.netWorthSection}>
            <TouchableOpacity
              style={[styles.netWorthEmpty, { backgroundColor: tc.surface, borderColor: tc.border }]}
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
            >
              <View style={[styles.netWorthEmptyIcon, { backgroundColor: tc.primarySubtle }]}>
                <Ionicons name="wallet-outline" size={24} color={tc.primary} />
              </View>
              <View style={styles.netWorthLeft}>
                <Text style={[styles.netWorthLabel, { color: tc.textMuted }]}>净资产</Text>
                <Text style={[styles.netWorthEmptyTitle, { color: tc.text }]}>还没有账户</Text>
                <Text style={[styles.netWorthHint, { color: tc.textSubtle }]}>
                  添加微信/支付宝/银行卡，开始追踪总资产
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.netWorthSection}>
            <TouchableOpacity
              style={[styles.netWorthCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
            >
              <View style={styles.netWorthLeft}>
                <Text style={[styles.netWorthLabel, { color: tc.textMuted }]}>净资产</Text>
                <Text style={[styles.netWorthAmount, { color: tc.text }]}>
                  {formatMoney(netWorth, settings.currency)}
                </Text>
                <Text style={[styles.netWorthHint, { color: tc.textSubtle }]}>
                  {accounts.length} 个账户
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* 资金账户 */}
        <View style={[styles.sectionWrap, { backgroundColor: tc.surfaceSection }]}>
        <View style={styles.accountsSection}>
          <View style={styles.accountsHeader}>
            <Text style={[styles.accountsTitle, { color: tc.text }]}>资金账户</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
              style={styles.accountsManage}
            >
              <Text style={[styles.accountsManageText, { color: tc.primary }]}>管理</Text>
              <Ionicons name="chevron-forward" size={14} color={tc.primary} />
            </TouchableOpacity>
          </View>
          {accounts.length === 0 ? (
            <View style={[styles.accountsEmpty, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <Ionicons name="wallet-outline" size={32} color={tc.textSubtle} />
              <Text style={[styles.accountsEmptyText, { color: tc.textMuted }]}>还没有账户</Text>
              <Text style={[styles.accountsEmptyHint, { color: tc.textSubtle }]}>点击「管理」添加微信/支付宝/银行卡</Text>
            </View>
          ) : (
            <View style={[styles.accountsList, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              {accounts.map((acc, i) => {
                const typeMeta = typeInfo(acc.type);
                const isLast = i === accounts.length - 1;
                return (
                  <View
                    key={acc.id}
                    style={[styles.accountRow, !isLast && { borderBottomColor: tc.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}
                  >
                    <View style={[styles.accountIcon, { backgroundColor: (acc.color || typeMeta.color) + '22' }]}>
                      <Ionicons name={acc.icon || typeMeta.icon} size={18} color={acc.color || typeMeta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountName, { color: tc.text }]} numberOfLines={1}>{acc.name}</Text>
                      <Text style={[styles.accountType, { color: tc.textSubtle }]}>{typeMeta.name}</Text>
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
          <View style={[styles.sectionWrap, { backgroundColor: tc.surfaceSection }]}>
            <View style={styles.aiCardWrap}>
              <View style={[styles.aiCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.aiCardLeft}>
                  <Text style={styles.aiCardEmoji}>✨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.aiCardTitle, { color: tc.text }]}>AI 助手</Text>
                    <Text style={[styles.aiCardHint, { color: tc.textMuted }]}>语音记账 · 问答分析</Text>
                  </View>
                </View>
                <View style={styles.aiCardBtns}>
                  <TouchableOpacity
                    style={[styles.aiCardBtn, { backgroundColor: tc.primary }]}
                    onPress={() => setShowVoiceRecord(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="mic" size={16} color={tc.primaryOn} />
                    <Text style={[styles.aiCardBtnText, { color: tc.primaryOn }]}>语音记</Text>
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
          </View>
        ) : null}

      </ScrollView>

      <VoiceRecordModal
        visible={showVoiceRecord}
        onClose={() => setShowVoiceRecord(false)}
        onSaved={() => { setShowVoiceRecord(false); reload(); }}
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
  sectionWrap: { paddingVertical: spacing.sm, marginBottom: spacing.sm },

  // 净资产
  netWorthSection: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  netWorthCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.base,
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, ...shadows.md,
  },
  netWorthLeft: { flex: 1 },
  netWorthLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, letterSpacing: 0.2, marginBottom: 6 },
  netWorthAmount: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.5, marginBottom: 4 },
  netWorthHint: { fontSize: fontSize.xs },
  netWorthEmpty: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.base,
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, ...shadows.md,
  },
  netWorthEmptyIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  netWorthEmptyTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    marginTop: 2, marginBottom: 4, letterSpacing: -0.2,
  },

  // AI 卡片
  aiCardWrap: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  aiCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, ...shadows.sm,
  },
  aiCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiCardEmoji: { fontSize: fontSize.xxl },
  aiCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 2, letterSpacing: -0.2 },
  aiCardHint: { fontSize: fontSize.xs, lineHeight: 16 },
  aiCardBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.full, gap: 4 },
  aiCardBtns: { flexDirection: 'row', gap: spacing.sm },
  aiCardBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // 资金账户
  accountsSection: { paddingHorizontal: spacing.base, paddingBottom: spacing.lg },
  accountsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm },
  accountsTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  accountsManage: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  accountsManageText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  accountsList: { borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', ...shadows.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  accountIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.1, marginBottom: 2 },
  accountType: { fontSize: fontSize.xs },
  accountBalance: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  accountsEmpty: {
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.xl,
    alignItems: 'center', gap: 4,
  },
  accountsEmptyText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, marginTop: spacing.sm },
  accountsEmptyHint: { fontSize: fontSize.xs, textAlign: 'center' },

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

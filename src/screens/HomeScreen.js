// 小璐记账 · 首页（仪表盘）
// v1.6.0 紫色渐变风格美化
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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney } from '../utils/currency';
import { loadAiConfig } from '../utils/aiConfig';
import { typeInfo } from '../utils/accountTypes';
import AiChatScreen from './AiChatScreen';
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

// ─── 装饰星星组件 ──────────────────────────────────────

function DecoStar({ style, size = 12, color = '#C4B5FD' }) {
  return (
    <Ionicons name="star" size={size} color={color} style={style} />
  );
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
  const [showAiChat, setShowAiChat] = useState(false);
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
    <View style={[styles.container, { backgroundColor: '#F5F3FF' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.text} />}
      >
        {/* ─── 问候 + 今日支出 + 账本切换 ──────────────── */}
        <View style={styles.header}>
          <View style={styles.appIconWrap}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <DecoStar style={styles.starTopRight} size={10} color="#A78BFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: tc.text }]}>
              {greeting.text}
            </Text>
            <Text style={[styles.dateText, { color: tc.textMuted }]}>{fmtDate()}</Text>
            {todayExpense > 0 ? (
              <View style={styles.todayRow}>
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>今日支出</Text>
                </View>
                <Text style={[styles.todayAmount, { color: tc.primary }]}>
                  -{formatMoney(todayExpense, settings.currency).replace(/[^0-9.,]/g, '')}
                </Text>
              </View>
            ) : (
              <Text style={[styles.todayNoop, { color: tc.textSubtle }]}>今天还没有记帐</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.bookChip, { backgroundColor: '#FFFFFF' }]}
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

        {/* ─── 净资产卡片 ────────────────────────────── */}
        <View style={styles.netWorthArea}>
          {accounts.length === 0 ? (
            <TouchableOpacity
              style={styles.netWorthCard}
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
            >
              <View style={styles.netWorthEmptyRow}>
                <View style={styles.netWorthEmptyIcon}>
                  <Ionicons name="wallet-outline" size={22} color="#7C5CFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.netWorthLabel}>净资产</Text>
                  <Text style={styles.netWorthEmptyTitle}>还没有账户</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C4B5FD" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.netWorthCard}
              onPress={() => navigation.navigate('NetWorth')}
              activeOpacity={0.7}
            >
              {/* 装饰元素 */}
              <DecoStar style={styles.starNetWorth1} size={14} color="#DDD6FE" />
              <DecoStar style={styles.starNetWorth2} size={10} color="#C4B5FD" />

              <Text style={styles.netWorthLabel}>
                <Ionicons name="layers-outline" size={13} color="#7C5CFF" /> 净资产
              </Text>
              <Text style={styles.netWorthAmount}>
                {formatMoney(netWorth, settings.currency)}
              </Text>
              <View style={styles.netWorthMeta}>
                <Text style={styles.netWorthHint}>
                  {accounts.length} 个账户
                </Text>
                <View style={styles.netWorthArrow}>
                  <Ionicons name="chevron-forward" size={16} color="#7C5CFF" />
                </View>
              </View>

              {/* 右侧装饰图标 */}
              <View style={styles.netWorthDecoWrap}>
                <View style={styles.netWorthDecoCircle}>
                  <Ionicons name="wallet" size={28} color="#DDD6FE" />
                </View>
                <Ionicons name="cash-outline" size={20} color="#C4B5FD" style={{ position: 'absolute', top: 8, right: 12 }} />
                <Ionicons name="card-outline" size={16} color="#DDD6FE" style={{ position: 'absolute', bottom: 12, right: 20 }} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── AI 助手 ───────────────────────────────── */}
        {aiEnabled ? (
          <View style={styles.section}>
            <View style={styles.aiCard}>
              {/* 装饰星星 */}
              <DecoStar style={styles.starAi1} size={10} color="#DDD6FE" />

              <View style={styles.aiCardLeft}>
                <View style={styles.aiIconWarp}>
                  <Ionicons name="sparkles" size={20} color="#7C5CFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>AI 助手</Text>
                  <Text style={styles.aiHint}>一句话记账 · 问答分析</Text>
                  <View style={styles.aiUnderline} />
                </View>
              </View>
              <View style={styles.aiBtns}>
                <TouchableOpacity
                  style={styles.aiBtnPrimary}
                  onPress={() => setShowAiChat(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                  <Text style={styles.aiBtnPrimaryText}>记账</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.aiBtnAccent}
                  onPress={() => setShowAiQA(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubbles" size={14} color="#FFFFFF" />
                  <Text style={styles.aiBtnAccentText}>问问</Text>
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
            <View style={styles.accountCard}>
              {accounts.map((acc, i) => {
                const meta = typeInfo(acc.type);
                const isLast = i === accounts.length - 1;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountRow, !isLast && styles.accountRowBorder]}
                    activeOpacity={0.6}
                    onPress={() => navigation.navigate('NetWorth')}
                  >
                    <View style={[styles.accountIcon, { backgroundColor: (acc.color || meta.color) + '20' }]}>
                      <Ionicons name={acc.icon || meta.icon} size={20} color={acc.color || meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName} numberOfLines={1}>{acc.name}</Text>
                      <Text style={styles.accountType}>{meta.name}</Text>
                    </View>
                    <Text style={styles.accountBalance}>
                      {formatMoney(acc.balance, settings.currency)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#DDD6FE" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>

      <AiChatScreen visible={showAiChat} onClose={() => setShowAiChat(false)} onSaved={() => { setShowAiChat(false); reload(); }} />
      <AiQAScreen visible={showAiQA} onClose={() => setShowAiQA(false)} />

      {/* 账本选择弹窗 */}
      <Modal visible={bookPickerOpen} transparent animationType="fade" onRequestClose={() => setBookPickerOpen(false)}>
        <Pressable style={styles.bookModalBackdrop} onPress={() => setBookPickerOpen(false)}>
          <Pressable style={[styles.bookModalSheet, { backgroundColor: '#FFFFFF' }]} onPress={() => {}}>
            <View style={[styles.bookModalHandle, { backgroundColor: '#E5E7EB' }]} />
            <Text style={[styles.bookModalTitle, { color: '#0F172A' }]}>选择账本</Text>
            {books.map((book) => {
              const active = book.id === currentBookId;
              return (
                <TouchableOpacity key={book.id} style={[styles.bookModalItem, { borderBottomColor: '#F1F5F9' }]} onPress={() => { switchBook(book.id); setBookPickerOpen(false); }} onLongPress={() => { setBookPickerOpen(false); openEditBook(book); }} activeOpacity={0.7}>
                  <View style={[styles.bookModalIcon, { backgroundColor: book.color + '22' }]}>
                    <Ionicons name={book.icon} size={16} color={book.color} />
                  </View>
                  <Text style={[styles.bookModalItemText, { color: active ? '#7C5CFF' : '#0F172A' }]}>{book.name}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color="#7C5CFF" /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[styles.bookModalAdd, { borderTopColor: '#F1F5F9' }]} onPress={() => { setBookPickerOpen(false); openAddBook(); }} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color="#7C5CFF" />
              <Text style={[styles.bookModalAddText, { color: '#7C5CFF' }]}>新建账本</Text>
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
    gap: spacing.md,
  },
  appIconWrap: {
    position: 'relative',
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  starTopRight: {
    position: 'absolute',
    top: -4,
    right: -6,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
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
  todayBadge: {
    backgroundColor: '#F3F0FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  todayBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: '#7C5CFF',
  },
  todayAmount: {
    fontSize: fontSize.xl,
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
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    marginTop: spacing.xs,
    ...shadows.sm,
  },
  bookChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    maxWidth: 90,
  },

  // 净资产卡片
  netWorthArea: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.base + 2,
    ...shadows.sm,
  },
  netWorthCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.base + 4,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
    ...shadows.md,
  },
  starNetWorth1: {
    position: 'absolute',
    top: 16,
    right: 80,
  },
  starNetWorth2: {
    position: 'absolute',
    top: 50,
    right: 40,
  },
  netWorthLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#7C5CFF',
    marginBottom: spacing.sm,
  },
  netWorthAmount: {
    fontSize: 38,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
    marginBottom: spacing.md,
    color: '#0F172A',
  },
  netWorthMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netWorthHint: {
    fontSize: fontSize.sm,
    color: '#94A3B8',
  },
  netWorthArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netWorthDecoWrap: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netWorthDecoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netWorthEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  netWorthEmptyIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F3FF',
  },
  netWorthEmptyTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2,
    marginTop: spacing.xxs,
    color: '#0F172A',
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

  // AI 卡片
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#F5F3FF',
    borderRadius: borderRadius.xl,
    padding: spacing.base + 2,
    position: 'relative',
    overflow: 'hidden',
  },
  starAi1: {
    position: 'absolute',
    top: 12,
    right: 16,
  },
  aiCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiIconWarp: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EDE9FE',
  },
  aiTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    marginBottom: spacing.xxs, letterSpacing: -0.2,
    color: '#0F172A',
  },
  aiHint: {
    fontSize: fontSize.xs, lineHeight: 16,
    color: '#7C5CFF',
  },
  aiUnderline: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#7C5CFF',
    marginTop: spacing.xs,
  },
  aiBtns: {
    flexDirection: 'row', gap: spacing.sm,
  },
  aiBtnPrimary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 1,
    borderRadius: borderRadius.full, gap: spacing.xs,
    backgroundColor: '#7C5CFF',
  },
  aiBtnPrimaryText: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
    color: '#FFFFFF',
  },
  aiBtnAccent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 1,
    borderRadius: borderRadius.full, gap: spacing.xs,
    backgroundColor: '#0891B2',
  },
  aiBtnAccentText: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
    color: '#FFFFFF',
  },

  // 账户列表
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md + 2, gap: spacing.md,
  },
  accountRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  accountIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  accountName: {
    fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.1,
    marginBottom: spacing.xxs,
    color: '#0F172A',
  },
  accountType: {
    fontSize: fontSize.xs,
    color: '#94A3B8',
  },
  accountBalance: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    marginRight: spacing.xs,
    color: '#0F172A',
  },

  // 空状态
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl + spacing.sm,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.md, fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
  },
  emptyHint: {
    fontSize: fontSize.xs,
  },

  // 账本弹窗
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

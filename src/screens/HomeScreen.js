// 璐璐记账 · 首页
// 设计：modern minimal · 单卡片分组 · 大量留白
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Platform,
  Animated,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { TransactionItem, EmptyState, SectionHeader } from '../components/SharedComponents';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { loadAiConfig } from '../utils/aiConfig';
import AiChatScreen from './AiChatScreen';
import { spacing, borderRadius, fontSize, fontWeight, shadows, getThemeColors } from '../theme';

function dayKey(iso) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function groupByDate(txList) {
  const groups = {};
  txList.forEach((t) => {
    const k = dayKey(t.date);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  });
  return groups;
}

function buildFlatData(grouped) {
  const data = [];
  Object.entries(grouped).forEach(([date, txs]) => {
    data.push({ type: 'header', date, txs });
    txs.forEach((t) => data.push({ type: 'tx', data: t }));
  });
  return data;
}

export default function HomeScreen({ navigation }) {
  const { transactions, currentBook, settings, getMonthSummary, reload, getNetWorth } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // 月份筛选（null = 全部；{year, month} = 限定到该月）
  const [monthFilter, setMonthFilter] = useState(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  // 列表内容总高度 < 屏幕高度时直接显示 sticky（避免 onScroll 不触发导致切不回）
  const [contentShort, setContentShort] = useState(false);

  // 输入框本地值：立即响应，不卡 IME
  const [inputValue, setInputValue] = useState('');
  // 真正用于过滤的搜索词：输入停 250ms 后才同步，避免 FlatList 频繁重建抢焦点
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // AI 配置状态：仅在 enabled 时显示卡片
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const cfg = await loadAiConfig();
      if (alive) setAiEnabled(!!(cfg.enabled && cfg.apiKey));
    };
    refresh();
    // 监听设置页保存后回来刷新
    const unsub = navigation.addListener('focus', refresh);
    return () => { alive = false; unsub(); };
  }, [navigation]);

  const onChangeSearch = useCallback((text) => {
    setInputValue(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(text);
      debounceRef.current = null;
    }, 250);
  }, []);

  const onClearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputValue('');
    setSearchQuery('');
  }, []);

  const now = new Date();
  const summary = getMonthSummary(now.getFullYear(), now.getMonth());
  const netWorth = getNetWorth();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const displayTransactions = useMemo(() => {
    // 按交易发生的日期倒序排（同一天内按 createdAt 倒序）
    let list = [...transactions].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
    });
    if (monthFilter) {
      list = list.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === monthFilter.year && d.getMonth() === monthFilter.month;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          (t.note && t.note.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [transactions, searchQuery, monthFilter]);

  const monthLabel = monthFilter
    ? (monthFilter.year + '年' + (monthFilter.month + 1) + '月')
    : '全部月份';
  const flatData = useMemo(() => buildFlatData(groupByDate(displayTransactions)), [displayTransactions]);


  // Animated.Value：stickyTrans.setValue 修改后 RN 自动同步到 native，不触发 React 重渲染，无 setState 闪烁
  const stickyTrans = useRef(new Animated.Value(-200)).current;

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'header') {
      const dayExpense = item.txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const dayIncome = item.txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const isFirst = index === 0;
      return (
        <View
          style={[
            styles.dateHeader,
            { borderTopLeftRadius: isFirst ? borderRadius.lg : 0, borderTopRightRadius: isFirst ? borderRadius.lg : 0 },
          ]}
        >
          <Text style={[styles.dateText, { color: tc.textMuted }]}>{item.date}</Text>
          <View style={styles.dateSummary}>
            {dayIncome > 0 ? (
              <Text style={[styles.dateAmount, { color: tc.success }]}>
                +{formatMoney(dayIncome, settings.currency)}
              </Text>
            ) : null}
            {dayExpense > 0 ? (
              <Text style={[styles.dateAmount, { color: tc.textMuted }]}>
                -{formatMoney(dayExpense, settings.currency)}
              </Text>
            ) : null}
          </View>
        </View>
      );
    }
    const isLastInList = flatData[index + 1]?.type === 'header' || index === flatData.length - 1;
    return (
      <TransactionItem
        transaction={item.data}
        currency={settings.currency}
        onPress={() => navigation.navigate('AddTransaction', { transaction: item.data })}
        isLast={isLastInList}
      />
    );
  }, [tc, settings.currency, navigation, flatData]);

  const renderHeader = useCallback(() => (
    <View>
      {/* 余额卡 */}
      <View style={styles.headerSection}>
        <View style={[styles.balanceCard, { backgroundColor: tc.surface, borderColor: tc.border, borderWidth: StyleSheet.hairlineWidth, ...shadows.sm }]}>
          <View style={styles.balanceBlock}>
            <Text style={[styles.balanceLabel, { color: tc.textMuted }]}>本月收支</Text>
            <Text style={[styles.balanceAmount, { color: summary.balance >= 0 ? tc.text : tc.danger }]}>
              {formatMoney(summary.balance, settings.currency)}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Main', { screen: 'NetWorth' })}
              activeOpacity={0.6}
              style={styles.netWorthRow}
            >
              <Text style={[styles.netWorthLabel, { color: tc.textMuted }]}>净资产</Text>
              <Text
                style={[styles.netWorthValue, { color: netWorth >= 0 ? tc.text : tc.danger }]}
                numberOfLines={1}
              >
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
              <Text style={[styles.statValue, { color: tc.text }]}>
                {formatMoney(summary.income, settings.currency)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statMeta}>
                <View style={[styles.statArrow, { backgroundColor: tc.dangerSubtle }]}>
                  <Ionicons name="arrow-up" size={10} color={tc.danger} />
                </View>
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>支出</Text>
              </View>
              <Text style={[styles.statValue, { color: tc.text }]}>
                {formatMoney(summary.expense, settings.currency)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* AI 智能记账卡片（仅启用时显示） */}
      {aiEnabled ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowAiChat(true)}
          style={styles.aiCardWrap}
        >
          <View
            style={[
              styles.aiCard,
              { backgroundColor: tc.surface, borderColor: tc.border },
            ]}
          >
            <View style={styles.aiCardLeft}>
              <Text style={styles.aiCardEmoji}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aiCardTitle, { color: tc.text }]}>试试一句话记账</Text>
                <Text style={[styles.aiCardHint, { color: tc.textMuted }]}>昨天打车 35 · 今天吃火锅 120</Text>
              </View>
            </View>
            <View style={[styles.aiCardBtn, { backgroundColor: tc.primary }]}>
              <Ionicons name="sparkles" size={18} color={tc.primaryOn} />
              <Text style={[styles.aiCardBtnText, { color: tc.primaryOn }]}>智能记账</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

<SectionHeader title={searchQuery ? '搜索结果' : '全部记录'} subtitle={searchQuery ? `匹配到 ${displayTransactions.length} 笔` : `共 ${displayTransactions.length} 笔`} />
    </View>
  ), [tc, summary, settings, navigation, netWorth, displayTransactions.length, aiEnabled, searchQuery, setShowAiChat]);

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      {/* Sticky 顶栏：Animated.Value 驱动 transform，setValue 不会触发 React 重渲染，无闪烁 */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          transform: [{ translateY: stickyTrans }],
        }}
      >
        <View style={[styles.stickyBar, { backgroundColor: tc.background, borderBottomColor: tc.divider, paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.stickyLeft}
            activeOpacity={0.7}
            onPress={() => setMonthPickerOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.stickyMonthText, { color: tc.text }]}>{monthLabel}</Text>
            <Ionicons name="chevron-down" size={14} color={tc.textMuted} />
          </TouchableOpacity>
          <View style={styles.stickyRight}>
            <Text style={[styles.stickyAmount, { color: tc.text }]}>
              {'支 '}{formatMoney(summary.expense, settings.currency)}
            </Text>
            <Text style={[styles.stickyAmount, { color: tc.textMuted, marginLeft: spacing.md }]}>
              {'收 '}{formatMoney(summary.income, settings.currency)}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* 月份选择弹窗 */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: tc.surface, borderColor: tc.border }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: tc.divider }]} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>选择月份</Text>
            <TouchableOpacity
              style={[styles.modalItem, { borderBottomColor: tc.divider }]}
              onPress={() => { setMonthFilter(null); setMonthPickerOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalItemText, { color: !monthFilter ? tc.primary : tc.text }]}>全部月份</Text>
              {!monthFilter ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
            </TouchableOpacity>
            {(() => {
              const seen = new Set();
              const opts = [];
              transactions.forEach((t) => {
                const d = new Date(t.date);
                const y = d.getFullYear();
                const m = d.getMonth();
                const k = y + '-' + m;
                if (!seen.has(k)) { seen.add(k); opts.push({ year: y, month: m }); }
              });
              opts.sort((a, b) => (b.year - a.year) || (b.month - a.month));
              return opts.map((opt) => {
                const active = monthFilter && monthFilter.year === opt.year && monthFilter.month === opt.month;
                return (
                  <TouchableOpacity
                    key={opt.year + '_' + opt.month}
                    style={[styles.modalItem, { borderBottomColor: tc.divider }]}
                    onPress={() => { setMonthFilter({ year: opt.year, month: opt.month }); setMonthPickerOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, { color: active ? tc.primary : tc.text }]}>
                      {opt.year}年{opt.month + 1}月
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
                  </TouchableOpacity>
                );
              });
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={flatData}
        keyExtractor={(item) => (item.type === 'header' ? `h_${item.date}` : `t_${item.data.id}`)}
        renderItem={renderItem}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          // sticky 顶栏位移：滚到 200px 后显示（translateY 0），否则藏到屏外（translateY -200）
          // 月份过滤激活时或内容不足时强制显示
          if (monthFilter || contentShort) {
            stickyTrans.setValue(0);
          } else {
            stickyTrans.setValue(y > 200 ? 0 : -200);
          }
        }}
        onContentSizeChange={(_w, h) => {
          // 估算屏幕高度 - ListHeader 高度 = 可滚动区域；内容 < 可滚动区 → 不足以滚动
          const avail = Dimensions.get('window').height - 320; // 粗略估 header+搜索框+tab bar
          setContentShort(h < avail);
        }}
        scrollEventThrottle={16}
        ListHeaderComponent={(
          <View>
            {renderHeader()}
            <View style={styles.searchBarWrap}>
              <View style={[styles.searchBar, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <Ionicons name="search" size={16} color={tc.textSubtle} />
                <TextInput
                  style={[styles.searchInput, { color: tc.text }]}
                  placeholder={'搜索分类或备注'}
                  placeholderTextColor={tc.textSubtle}
                  value={inputValue}
                  onChangeText={onChangeSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  returnKeyType="search"
                />
                {inputValue.length > 0 ? (
                  <TouchableOpacity onPress={onClearSearch} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close-circle" size={16} color={tc.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="receipt-outline"
              title={searchQuery ? '没有找到匹配的记录' : '还没记账记录'}
              subtitle={searchQuery ? '换个关键词试试' : '点击右下角按钮开始记账第一笔'}
            />
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.text} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
      />

      <AiChatScreen
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSaved={() => { setShowAiChat(false); reload(); }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerSection: { paddingHorizontal: spacing.base, paddingTop: spacing.md },

  // AI 卡片
  aiCardWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  aiCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiCardEmoji: { fontSize: 32 },
  aiCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 2, letterSpacing: -0.2 },
  aiCardHint: { fontSize: fontSize.xs, lineHeight: 16 },
  aiCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  aiCardBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  balanceCard: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBlock: { marginTop: spacing.lg },
  balanceLabel: {
    fontSize: fontSize.sm,
    letterSpacing: -0.1,
  },
  netWorthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  netWorthLabel: {
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
  },
  netWorthValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  balanceAmount: {
    fontSize: 44,
    fontWeight: fontWeight.bold,
    letterSpacing: -1.5,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.base,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1 },
  statMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statArrow: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xxs,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },

  searchBarWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    height: 40,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, paddingVertical: 0, letterSpacing: -0.1 },

  listContent: { paddingBottom: 120 },
  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  sectionAction: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dateText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
    textTransform: 'uppercase',
  },
  dateSummary: { flexDirection: 'row', gap: spacing.md },
  dateAmount: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },


  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stickyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyMonthText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  stickyAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalItemText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },

});

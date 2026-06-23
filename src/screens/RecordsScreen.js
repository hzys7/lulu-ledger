// 小璐记账 · 全部记录（v1.6.1 紫色风格美化）
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Animated,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { TransactionItem, EmptyState } from '../components/SharedComponents';
import TransactionDetailModal from '../components/TransactionDetailModal';
import BudgetPieChart from '../components/BudgetPieChart';
import { formatMoney } from '../utils/currency';
import { spacing, borderRadius, fontSize, fontWeight, shadows, getThemeColors } from '../theme';

function dayKey(iso) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
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

export default function RecordsScreen({ navigation }) {
  const { transactions, settings, getMonthSummary, reload, accounts, removeTx, budgets } = useFinance();
  const tc = useMemo(() => getThemeColors(settings.theme), [settings.theme]);
  const [detailTx, setDetailTx] = useState(null);
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [monthFilter, setMonthFilter] = useState(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHint, setShowHint] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const now = new Date();
  const summaryYear = monthFilter ? monthFilter.year : now.getFullYear();
  const summaryMonth = monthFilter ? monthFilter.month : now.getMonth();
  const summary = getMonthSummary(summaryYear, summaryMonth);
  const summaryMonthStr = summaryYear + '-' + String(summaryMonth + 1).padStart(2, '0');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const onChangeSearch = useCallback((text) => {
    setInputValue(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearchQuery(text); debounceRef.current = null; }, 250);
  }, []);

  const onClearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputValue('');
    setSearchQuery('');
  }, []);

  const displayTransactions = useMemo(() => {
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
    const q = searchQuery.trim();
    if (q) {
      const ql = q.toLowerCase();
      let minAmount = null;
      let maxAmount = null;
      const keywords = [];
      const gtMatch = ql.match(/(?:>|大于|超过)\s*(\d+(?:\.\d+)?)/) || ql.match(/(\d+(?:\.\d+)?)\s*以上/);
      if (gtMatch) minAmount = parseFloat(gtMatch[1]);
      const ltMatch = ql.match(/(?:<|小于|不到|低于)\s*(\d+(?:\.\d+)?)/) || ql.match(/(\d+(?:\.\d+)?)\s*以下/);
      if (ltMatch) maxAmount = parseFloat(ltMatch[1]);
      const rangeMatch = ql.match(/(\d+(?:\.\d+)?)\s*(?:[-~到至])\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch && minAmount === null && maxAmount === null) {
        minAmount = parseFloat(rangeMatch[1]);
        maxAmount = parseFloat(rangeMatch[2]);
      }
      let remainder = ql
        .replace(/(?:>|大于|超过)\s*\d+(?:\.\d+)?/g, '')
        .replace(/\d+(?:\.\d+)?\s*以上/g, '')
        .replace(/(?:<|小于|不到|低于)\s*\d+(?:\.\d+)?/g, '')
        .replace(/\d+(?:\.\d+)?\s*以下/g, '')
        .replace(/\d+(?:\.\d+)?\s*[-~到至]\s*\d+(?:\.\d+)?/g, '')
        .trim();
      if (remainder) {
        remainder.split(/\s+/).forEach((kw) => { const w = kw.trim(); if (w) keywords.push(w); });
      }
      list = list.filter((t) => {
        if (minAmount !== null && t.amount < minAmount) return false;
        if (maxAmount !== null && t.amount > maxAmount) return false;
        if (keywords.length > 0) {
          const acctName = ((accounts?.find(a => a.id === t.accountId)?.name) || '').toLowerCase();
          const catName = (t.category || '').toLowerCase();
          const noteText = (t.note || '').toLowerCase();
          const amountStr = String(t.amount);
          return keywords.some((kw) => {
            if (catName.includes(kw) || noteText.includes(kw) || acctName.includes(kw)) return true;
            if (/^\d+(\.\d+)?$/.test(kw)) return amountStr.includes(kw);
            return false;
          });
        }
        return true;
      });
    }
    return list;
  }, [transactions, searchQuery, monthFilter, accounts]);

  const monthLabel = monthFilter
    ? (monthFilter.year + '年' + (monthFilter.month + 1) + '月')
    : '全部月份';
  const flatData = useMemo(() => buildFlatData(groupByDate(displayTransactions)), [displayTransactions]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = 260;
  const stickyTranslateY = useMemo(() =>
    scrollY.interpolate({
      inputRange: [0, HEADER_HEIGHT],
      outputRange: [-90, 0],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'header') {
      const dayExpense = item.txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const dayIncome = item.txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const isFirst = index === 0;
      return (
        <View style={[styles.dateHeader, isFirst && styles.dateHeaderFirst]}>
          <Text style={styles.dateText}>{item.date}</Text>
          <View style={styles.dateSummary}>
            {dayIncome > 0 ? <Text style={styles.dateAmountIncome}>+{formatMoney(dayIncome, settings.currency)}</Text> : null}
            {dayExpense > 0 ? <Text style={styles.dateAmountExpense}>-{formatMoney(dayExpense, settings.currency)}</Text> : null}
          </View>
        </View>
      );
    }
    const isLastInList = flatData[index + 1]?.type === 'header' || index === flatData.length - 1;
    return (
      <TransactionItem
        transaction={item.data}
        currency={settings.currency}
        onPress={() => setDetailTx(item.data)}
        isLast={isLastInList}
      />
    );
  }, [settings.currency, navigation, flatData]);

  return (
    <View style={[styles.container, { backgroundColor: tc.pageBg }]}>
      {/* Sticky 顶栏 */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          transform: [{ translateY: stickyTranslateY }],
        }}
      >
        <View style={[styles.stickyBar, { backgroundColor: tc.pageBg, paddingTop: insets.top, borderBottomColor: tc.divider }]}>
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
            <Text style={[styles.stickyAmount, { color: tc.text }]}>支 {formatMoney(summary.expense, settings.currency)}</Text>
            <Text style={[styles.stickyAmountIncome, { color: tc.success }]}>收 {formatMoney(summary.income, settings.currency)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* 月份选择弹窗 */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: tc.surface }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: tc.divider }]} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>选择月份</Text>
            <TouchableOpacity
              style={[styles.modalItem, { borderBottomColor: tc.divider }]}
              onPress={() => { setMonthFilter(null); setMonthPickerOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalItemText, { color: !monthFilter ? tc.primary : tc.text }]}>{!monthFilter && styles.modalItemTextActive}全部月份</Text>
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
                    <Text style={[styles.modalItemText, { color: active ? tc.primary : tc.text }]}>{opt.year}年{opt.month + 1}月</Text>
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={(
          <View style={{ paddingTop: insets.top + spacing.sm }}>
            {/* 预算环形图 */}
            <View style={styles.budgetSection}>
              <BudgetPieChart
                budgets={(budgets || []).filter((b) => b.month === summaryMonthStr)}
                byCategory={summary.byCategory || {}}
                tc={tc}
                categoryColors={tc.categories}
                onNavigateBudget={() => navigation.navigate('Budget', { month: summaryMonthStr })}
                currency={settings.currency}
              />
            </View>
            {/* 搜索框 */}
            <View style={styles.searchBarWrap}>
              <View style={[styles.searchBar, { backgroundColor: tc.card }]}>
                <Ionicons name="search" size={16} color={tc.textSubtle} />
                <TextInput
                  style={[styles.searchInput, { color: tc.text }]}
                  placeholder="搜索金额(如 大于100) · 关键词 · 账户"
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
                ) : (
                  <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="filter-outline" size={18} color={tc.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.countRow}>
              <Text style={[styles.countText, { color: tc.textMuted }]}>
                {searchQuery ? `匹配到 ${displayTransactions.length} 笔` : `共${displayTransactions.length}笔记录`}
              </Text>
              {!searchQuery ? (
                <TouchableOpacity
                  onPress={() => setShowHint(!showHint)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name={showHint ? 'help-circle' : 'help-circle-outline'}
                    size={15}
                    color={showHint ? tc.primary : tc.textSubtle}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            {(showHint && !searchQuery) ? (
              <View style={[styles.hintBox, { backgroundColor: tc.card }]}>
                <View style={styles.hintRow}>
                  <Text style={[styles.hintLabel, { color: tc.primary }]}>{'大于100'}</Text>
                  <Text style={[styles.hintDesc, { color: tc.textSecondary }]}>金额≥100</Text>
                  <Text style={[styles.hintLabel, { color: tc.primary }]}>{'小于50'}</Text>
                  <Text style={[styles.hintDesc, { color: tc.textSecondary }]}>金额≤50</Text>
                </View>
                <View style={styles.hintRow}>
                  <Text style={[styles.hintLabel, { color: tc.primary }]}>100到500</Text>
                  <Text style={[styles.hintDesc, { color: tc.textSecondary }]}>金额区间</Text>
                  <Text style={[styles.hintLabel, { color: tc.primary }]}>88</Text>
                  <Text style={[styles.hintDesc, { color: tc.textSecondary }]}>金额包含88</Text>
                </View>
                <View style={styles.hintRow}>
                  <Text style={styles.hintLabel}>吃饭</Text>
                  <Text style={styles.hintDesc}>搜分类/备注</Text>
                  <Text style={styles.hintLabel}>{'超过100 吃饭'}</Text>
                  <Text style={styles.hintDesc}>组合搜索</Text>
                </View>
                <Text style={styles.hintTip}>也支持：超过、不到、以上、以下、~、至</Text>
              </View>
            ) : null}
            {(searchQuery && displayTransactions.length === 0) ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintTip}>试试：大于100、小于50、100到500、直接输数字搜金额、或输入关键词</Text>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="receipt-outline"
              title={searchQuery ? '没有找到匹配的记录' : '还没有记账记录'}
              subtitle={searchQuery ? '换个关键词试试' : '点击下方 + 按钮开始记账第一笔'}
            />
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C5CFF" />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      />

      <TransactionDetailModal
        visible={!!detailTx}
        transaction={detailTx}
        accounts={accounts}
        tc={tc}
        onEdit={() => {
          if (detailTx) {
            setDetailTx(null);
            navigation.navigate('AddTransaction', { transaction: detailTx });
          }
        }}
        onDelete={() => {
          if (detailTx) {
            const txToDelete = detailTx;
            Alert.alert('删除交易', '确定删除这条记录吗？', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: async () => { await removeTx(txToDelete.id, txToDelete); setDetailTx(null); } },
            ]);
          }
        }}
        onClose={() => setDetailTx(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },

  stickyBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stickyRight: { flexDirection: 'row', alignItems: 'center' },
  stickyMonthText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  stickyAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'] },
  stickyAmountIncome: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'], marginLeft: spacing.md },

  budgetSection: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },

  searchBarWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, height: 42, gap: spacing.sm,
    ...shadows.sm,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, paddingVertical: 0, letterSpacing: -0.1 },

  countRow: {
    paddingHorizontal: spacing.base, paddingBottom: spacing.xs,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countText: { fontSize: fontSize.xs, letterSpacing: -0.1 },

  hintBox: {
    marginHorizontal: spacing.base, marginTop: spacing.xs, marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 4,
    ...shadows.sm,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, fontFamily: 'monospace', minWidth: 52 },
  hintDesc: { fontSize: fontSize.xs, flex: 1 },
  hintTip: { fontSize: fontSize.xs, lineHeight: 17 },

  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  dateHeaderFirst: {
    paddingTop: spacing.sm,
  },
  dateText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: -0.1 },
  dateSummary: { flexDirection: 'row', gap: spacing.md },
  dateAmountIncome: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  dateAmountExpense: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: spacing.sm, letterSpacing: -0.3 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, borderBottomWidth: StyleSheet.hairlineWidth },
  modalItemText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
});

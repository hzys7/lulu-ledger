// 璐璐记账 · 全部记录
// 从首页独立出来的完整交易列表页，支持搜索、月份筛选、日期分组
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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { TransactionItem, EmptyState } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors } from '../theme';

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
  const { transactions, settings, getMonthSummary, reload } = useFinance();
  const tc = useMemo(() => getThemeColors(settings.theme), [settings.theme]);
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [monthFilter, setMonthFilter] = useState(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [contentShort, setContentShort] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const now = new Date();
  const summary = getMonthSummary(now.getFullYear(), now.getMonth());

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
      // Multi-dimensional search: support amount range, account name,
      // category, and note keywords.
      //
      // Syntax examples:
      //   >100       — amount greater than 100
      //   <50        — amount less than 50
      //   100-500    — amount between 100 and 500
      //   微信        — matches account name, category, or note
      //   >100 吃饭  — combination: amount > 100 AND (category/note has 吃饭)
      const ql = q.toLowerCase();
      let minAmount = null;
      let maxAmount = null;
      const keywords = [];

      // Parse amount range patterns from the query string
      const gtMatch = ql.match(/>\s*(\d+(\.\d+)?)/);
      if (gtMatch) minAmount = parseFloat(gtMatch[1]);
      const ltMatch = ql.match(/<\s*(\d+(\.\d+)?)/);
      if (ltMatch) maxAmount = parseFloat(ltMatch[1]);
      const rangeMatch = ql.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
      if (rangeMatch) {
        minAmount = parseFloat(rangeMatch[1]);
        maxAmount = parseFloat(rangeMatch[3]);
      }

      // The remaining text (after stripping parsed patterns) are keywords
      // matched against category, note, and account name.
      let remainder = ql
        .replace(/>\s*\d+(\.\d+)?/g, '')
        .replace(/<\s*\d+(\.\d+)?/g, '')
        .replace(/\d+(\.\d+)?\s*-\s*\d+(\.\d+)?/g, '')
        .trim();
      if (remainder) {
        remainder.split(/\s+/).forEach((kw) => {
          const w = kw.trim();
          if (w) keywords.push(w);
        });
      }

      list = list.filter((t) => {
        // Amount filter
        if (minAmount !== null && t.amount < minAmount) return false;
        if (maxAmount !== null && t.amount > maxAmount) return false;
        // Keyword filter: match against category, note, AND account name
        if (keywords.length > 0) {
          const acctName = (t.account || '').toLowerCase();
          const catName = (t.category || '').toLowerCase();
          const noteText = (t.note || '').toLowerCase();
          return keywords.some((kw) =>
            catName.includes(kw) || noteText.includes(kw) || acctName.includes(kw),
          );
        }
        return true;
      });
    }
    return list;
  }, [transactions, searchQuery, monthFilter]);

  const monthLabel = monthFilter
    ? (monthFilter.year + '年' + (monthFilter.month + 1) + '月')
    : '全部月份';
  const flatData = useMemo(() => buildFlatData(groupByDate(displayTransactions)), [displayTransactions]);

  const stickyTrans = useRef(new Animated.Value(-200)).current;

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'header') {
      const dayExpense = item.txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const dayIncome = item.txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const isFirst = index === 0;
      return (
        <View style={[styles.dateHeader, { borderTopLeftRadius: isFirst ? borderRadius.lg : 0, borderTopRightRadius: isFirst ? borderRadius.lg : 0 }]}>
          <Text style={[styles.dateText, { color: tc.textMuted }]}>{item.date}</Text>
          <View style={styles.dateSummary}>
            {dayIncome > 0 ? <Text style={[styles.dateAmount, { color: tc.success }]}>+{formatMoney(dayIncome, settings.currency)}</Text> : null}
            {dayExpense > 0 ? <Text style={[styles.dateAmount, { color: tc.textMuted }]}>-{formatMoney(dayExpense, settings.currency)}</Text> : null}
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

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      {/* Sticky 顶栏 */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
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
            <Text style={[styles.stickyAmount, { color: tc.text }]}>支 {formatMoney(summary.expense, settings.currency)}</Text>
            <Text style={[styles.stickyAmount, { color: tc.textMuted, marginLeft: spacing.md }]}>收 {formatMoney(summary.income, settings.currency)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* 月份选择弹窗 */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
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
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (monthFilter || contentShort) {
            stickyTrans.setValue(0);
          } else {
            stickyTrans.setValue(y > 200 ? 0 : -200);
          }
        }}
        onContentSizeChange={(_w, h) => {
          const avail = Dimensions.get('window').height - 320;
          setContentShort(h < avail);
        }}
        scrollEventThrottle={16}
        ListHeaderComponent={(
          <View style={{ paddingTop: insets.top + spacing.sm }}>
            {/* 搜索框 */}
            <View style={styles.searchBarWrap}>
              <View style={[styles.searchBar, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <Ionicons name="search" size={16} color={tc.textSubtle} />
                <TextInput
                  style={[styles.searchInput, { color: tc.text }]}
                  placeholder="搜金额 >100 · 关键词 · 账户"
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
            <View style={styles.countRow}>
              <Text style={[styles.countText, { color: tc.textMuted }]}>
                {searchQuery ? `匹配到 ${displayTransactions.length} 笔` : `共 ${displayTransactions.length} 笔记录`}
              </Text>
            </View>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.text} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stickyRight: { flexDirection: 'row', alignItems: 'center' },
  stickyMonthText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  stickyAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'], letterSpacing: -0.1 },

  searchBarWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, paddingVertical: 0, letterSpacing: -0.1 },
  countRow: { paddingHorizontal: spacing.base, paddingBottom: spacing.xs },
  countText: { fontSize: fontSize.xs, letterSpacing: -0.1 },

  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  dateText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: -0.1, textTransform: 'uppercase' },
  dateSummary: { flexDirection: 'row', gap: spacing.md },
  dateAmount: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'], letterSpacing: -0.1 },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base, borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: spacing.sm, letterSpacing: -0.3 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, borderBottomWidth: StyleSheet.hairlineWidth },
  modalItemText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
});

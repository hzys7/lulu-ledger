// 小璐记账 · 分类明细页
// 从统计页"分类构成"点击某个分类后进入，展示该分类下所有交易明细
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { CategoryIcon } from '../components/CategoryIcon';
import { TransactionItem } from '../components/TransactionItem';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { formatMoney } from '../utils/currency';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
} from '../theme';
import { useThemeColors } from '../hooks/useThemeColors';

// ─── 日期分组 ───────────────────────────────────────────────
function groupByDate(txs) {
  const map = new Map();
  txs.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  });
  // 按日期倒序排列
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const d = new Date(key);
      const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
      const dayTotal = items
        .filter(i => i.type === 'expense')
        .reduce((s, i) => s + i.amount, 0);
      return { key, date: d, weekday, items, dayTotal };
    });
}

function dateLabel(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日 ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]}`;
}

// ─── 时间段文案 ─────────────────────────────────────────────
function periodLabel(period, periodParams) {
  if (period === 'week') {
    const s = new Date(periodParams.weekStart);
    const e = new Date(periodParams.weekEnd);
    return `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
  }
  if (period === 'month') {
    return `${periodParams.year}年${periodParams.month + 1}月`;
  }
  return `${periodParams.year}年`;
}

export default function CategoryDetailScreen({ route, navigation }) {
  const {
    categoryName,
    color,
    period,
    dataType,
    periodParams,
    totalAmount,
  } = route.params;

  const tc = useThemeColors();
  const insets = useSafeAreaInsets();
  const { transactions, settings, accounts, removeTx } = useFinance();

  const [detailTx, setDetailTx] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 每次页面 focus 时刷新，确保编辑/删除后数据更新
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(k => k + 1);
    }, [])
  );

  // ── 过滤当期的该分类交易 ──
  const filteredTx = useMemo(() => {
    let txs = transactions.filter(t => t.category === categoryName && t.type === dataType);

    if (period === 'week') {
      const start = new Date(periodParams.weekStart);
      const end = new Date(periodParams.weekEnd);
      txs = txs.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    } else if (period === 'month') {
      txs = txs.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === periodParams.year && d.getMonth() === periodParams.month;
      });
    } else {
      txs = txs.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === periodParams.year;
      });
    }

    // 按时间倒序
    return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, categoryName, dataType, period, periodParams, refreshKey]);

  // ── 分组 ──
  const groups = useMemo(() => groupByDate(filteredTx), [filteredTx]);

  // ── 汇总 ──
  const summary = useMemo(() => {
    const total = filteredTx.reduce((s, t) => s + t.amount, 0);
    const count = filteredTx.length;
    const pct = totalAmount > 0 ? Math.round((total / totalAmount) * 100) : 0;
    const avg = count > 0 ? total / count : 0;
    return { total, count, pct, avg };
  }, [filteredTx, totalAmount]);

  // ── FlatList 数据：日期头 + 交易行 ──
  const listData = useMemo(() => {
    const items = [];
    groups.forEach(group => {
      items.push({ type: 'header', key: group.key, date: group.date, weekday: group.weekday, dayTotal: group.dayTotal });
      group.items.forEach((tx, idx) => {
        items.push({
          type: 'transaction',
          key: tx.id,
          tx,
          isLast: idx === group.items.length - 1,
        });
      });
    });
    return items;
  }, [groups]);

  // ── 删除交易 ──
  const handleDelete = async (tx) => {
    await removeTx(tx.id, tx);
    setDetailTx(null);
  };

  // ── 编辑交易 ──
  const handleEdit = (tx) => {
    setDetailTx(null);
    navigation.navigate('AddTransaction', { transaction: tx });
  };

  // ── 渲染 ──
  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.dateHeader, { borderBottomColor: tc.divider }]}>
          <Text style={[styles.dateHeaderText, { color: tc.textSecondary }]}>
            {dateLabel(item.date)}
          </Text>
          {item.dayTotal > 0 && (
            <Text style={[styles.dayTotalText, { color: tc.textMuted }]}>
              小计 -{formatMoney(item.dayTotal, settings.currency).replace('¥', '')}
            </Text>
          )}
        </View>
      );
    }

    return (
      <TransactionItem
        transaction={item.tx}
        onPress={() => setDetailTx(item.tx)}
        currency={settings.currency}
        isLast={item.isLast}
      />
    );
  }, [tc, settings.currency]);

  const headerComponent = useMemo(() => (
    <View>
      {/* 分类汇总卡片 */}
      <View style={[styles.summaryCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
        <View style={styles.summaryTop}>
          <CategoryIcon category={categoryName} type={dataType} size={48} />
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryCategory, { color: tc.text }]}>{categoryName}</Text>
            <Text style={[styles.summaryPeriod, { color: tc.textMuted }]}>
              {periodLabel(period, periodParams)}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryAmountRow, { borderTopColor: tc.divider }]}>
          <View style={styles.summaryStat}>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>
              {dataType === 'expense' ? '总支出' : '总收入'}
            </Text>
            <Text style={[styles.statValue, { color: tc.text }]}>
              {formatMoney(summary.total, settings.currency)}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: tc.divider }]} />
          <View style={styles.summaryStat}>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>笔数</Text>
            <Text style={[styles.statValue, { color: tc.text }]}>{summary.count}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: tc.divider }]} />
          <View style={styles.summaryStat}>
            <Text style={[styles.statLabel, { color: tc.textMuted }]}>占比</Text>
            <Text style={[styles.statValue, { color: color || tc.text }]}>{summary.pct}%</Text>
          </View>
        </View>

        {summary.count > 0 && (
          <View style={[styles.avgRow]}>
            <Text style={[styles.avgLabel, { color: tc.textSubtle }]}>
              平均每笔
            </Text>
            <Text style={[styles.avgValue, { color: tc.textSecondary }]}>
              {formatMoney(summary.avg, settings.currency)}
            </Text>
          </View>
        )}
      </View>

      {/* 明细标题 */}
      {summary.count > 0 && (
        <View style={styles.detailTitleRow}>
          <Text style={[styles.detailTitle, { color: tc.textMuted }]}>
            交易明细 · {summary.count}笔
          </Text>
        </View>
      )}
    </View>
  ), [tc, categoryName, dataType, period, periodParams, summary, color, settings.currency]);

  const emptyComponent = useMemo(() => (
    <View style={styles.emptyWrap}>
      <Ionicons name="receipt-outline" size={48} color={tc.textSubtle} />
      <Text style={[styles.emptyText, { color: tc.textMuted }]}>
        该分类下暂无记录
      </Text>
    </View>
  ), [tc]);

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={item => item.key}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={emptyComponent}
        stickyHeaderIndices={[]}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      />

      <TransactionDetailModal
        visible={!!detailTx}
        transaction={detailTx}
        accounts={accounts}
        tc={tc}
        onEdit={() => {
          if (detailTx) handleEdit(detailTx);
        }}
        onDelete={() => {
          if (detailTx) {
            const txToDelete = detailTx;
            Alert.alert('删除交易', '确定删除这条记录吗？', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => handleDelete(txToDelete) },
            ]);
          }
        }}
        onClose={() => setDetailTx(null)}
      />
    </View>
  );
}

// ============================================================
//  Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // 汇总卡片
  summaryCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  summaryCategory: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  summaryPeriod: {
    fontSize: fontSize.sm,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    height: 28,
  },

  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  avgLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  avgValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  // 明细标题
  detailTitleRow: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  detailTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },

  // 日期头
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },
  dayTotalText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },

  // 空状态
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    fontSize: fontSize.base,
    marginTop: spacing.md,
    letterSpacing: -0.1,
  },
});

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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { TransactionItem, EmptyState } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import { loadAiConfig } from '../utils/aiConfig';
import AiChatScreen from './AiChatScreen';
import { spacing, borderRadius, fontSize, fontWeight, shadows, getThemeColors } from '../theme';

export default function HomeScreen({ navigation }) {
  const { transactions, settings, getMonthSummary, reload, getNetWorth } = useFinance();
  const tc = useMemo(() => getThemeColors(settings.theme), [settings.theme]);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const summary = getMonthSummary(now.getFullYear(), now.getMonth());
  const netWorth = getNetWorth();

  // AI 配置
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const focusCheckRef = useRef(false);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const cfg = await loadAiConfig();
      if (alive) setAiEnabled(!!(cfg.enabled && cfg.apiKey));
    };
    // Check on mount
    refresh();
    // Also check when the screen gains focus (e.g. coming back from Settings)
    if (!focusCheckRef.current) {
      focusCheckRef.current = true;
      const unsub = navigation.addListener('focus', refresh);
      return () => { alive = false; unsub(); };
    }
    return () => { alive = false; };
  }, [navigation]);

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
        {/* 顶部间距（已删除标题和记一笔按钮） */}
        <View style={{ height: spacing.sm }} />

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

        {/* AI 智能记账（仅启用时显示） */}
        {aiEnabled ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowAiChat(true)}
            style={styles.aiCardWrap}
          >
            <View style={[styles.aiCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md,
  },
  aiCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiCardEmoji: { fontSize: 32 },
  aiCardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 2, letterSpacing: -0.2 },
  aiCardHint: { fontSize: fontSize.xs, lineHeight: 16 },
  aiCardBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.full, gap: 4 },
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
  recentList: { borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

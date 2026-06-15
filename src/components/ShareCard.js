// 璐璐记账 · 分享卡片
// 一个精美的紧凑型报告摘要 View，用 react-native-view-shot 截图后分享为图片
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../utils/currency';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

export default function ShareCard({
  period,   // 'week' | 'month' | 'year'
  year,
  month,    // 0-based, only for month
  weekLabel,// only for week
  totalIncome,
  totalExpense,
  balance,
  topCategories, // [{ name, amount, color }]
  dataType, // 'expense' | 'income'
  currency,
}) {
  const periodLabel = period === 'week' ? weekLabel
    : period === 'month' ? `${year}年${month + 1}月`
    : `${year}年度`;

  const topLabel = dataType === 'expense' ? '支出' : '收入';
  const totalAmount = dataType === 'expense' ? totalExpense : totalIncome;

  return (
    <View style={styles.card}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.appName}>璐璐记账</Text>
        <Text style={styles.periodText}>{periodLabel}</Text>
      </View>

      {/* 大数字 */}
      <View style={styles.mainRow}>
        <View style={styles.mainItem}>
          <Text style={styles.mainLabel}>收入</Text>
          <Text style={[styles.mainValue, { color: '#059669' }]}>
            {formatMoney(totalIncome, currency)}
          </Text>
        </View>
        <View style={styles.mainDivider} />
        <View style={styles.mainItem}>
          <Text style={styles.mainLabel}>支出</Text>
          <Text style={[styles.mainValue, { color: '#0F172A' }]}>
            {formatMoney(totalExpense, currency)}
          </Text>
        </View>
        <View style={styles.mainDivider} />
        <View style={styles.mainItem}>
          <Text style={styles.mainLabel}>结余</Text>
          <Text style={[styles.mainValue, { color: balance >= 0 ? '#059669' : '#DC2626' }]}>
            {formatMoney(balance, currency)}
          </Text>
        </View>
      </View>

      {/* 分类排行 */}
      {topCategories.length > 0 && (
        <View style={styles.catSection}>
          <Text style={styles.catTitle}>{topLabel}排行 TOP {Math.min(topCategories.length, 5)}</Text>
          {topCategories.slice(0, 5).map((cat, i) => {
            const pct = totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0;
            return (
              <View key={cat.name} style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={styles.catName}>{cat.name}</Text>
                <View style={styles.catBarBg}>
                  <View style={[styles.catBar, { width: pct + '%', backgroundColor: cat.color }]} />
                </View>
                <Text style={styles.catAmount}>{formatMoney(cat.amount, currency)}</Text>
                <Text style={styles.catPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 底部 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>由 璐璐记账 生成</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  periodText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.8,
    marginTop: 4,
  },

  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  mainItem: {
    flex: 1,
    alignItems: 'center',
  },
  mainDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  mainLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  mainValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  catSection: {
    marginBottom: 20,
  },
  catTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    width: 50,
  },
  catBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBar: {
    height: '100%',
    borderRadius: 3,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    width: 80,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  catPct: {
    fontSize: 11,
    color: '#94A3B8',
    width: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  footer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});

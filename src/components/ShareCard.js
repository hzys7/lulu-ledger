// 小璐记账 · 分享卡片（精致版）
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../utils/currency';

const THEMES = {
  light: {
    bg: '#FFFFFF',
    cardBg: '#F8FAFC',
    primary: '#111827',
    accent: '#667EEA',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E5E7EB',
    success: '#059669',
    danger: '#DC2626',
  },
  dark: {
    bg: '#1E1E2E',
    cardBg: '#2A2A3C',
    primary: '#F1F5F9',
    accent: '#818CF8',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    success: '#34D399',
    danger: '#F87171',
  },
};

export default function ShareCard({
  period, year, month, weekLabel,
  totalIncome, totalExpense, balance,
  topCategories, dataType, currency,
  theme = 'light',
}) {
  const t = THEMES[theme] || THEMES.light;
  const periodLabel = period === 'week' ? weekLabel
    : period === 'month' ? `${year}年${month + 1}月`
    : `${year}年度`;
  const topLabel = dataType === 'expense' ? '支出' : '收入';
  const totalAmount = dataType === 'expense' ? totalExpense : totalIncome;

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={[styles.appName, { color: t.textMuted }]}>小璐记账</Text>
        <Text style={[styles.periodText, { color: t.text }]}>{periodLabel}</Text>
        <View style={[styles.badge, { backgroundColor: t.primary }]}>
          <Text style={styles.badgeText}>{topLabel}报告</Text>
        </View>
      </View>

      {/* 核心数据 */}
      <View style={[styles.dataCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>收入</Text>
            <Text style={[styles.dataValue, { color: t.success }]}>
              {formatMoney(totalIncome, currency)}
            </Text>
          </View>
          <View style={[styles.dataDivider, { backgroundColor: t.border }]} />
          <View style={styles.dataItem}>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>支出</Text>
            <Text style={[styles.dataValue, { color: t.text }]}>
              {formatMoney(totalExpense, currency)}
            </Text>
          </View>
          <View style={[styles.dataDivider, { backgroundColor: t.border }]} />
          <View style={styles.dataItem}>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>结余</Text>
            <Text style={[styles.dataValue, { color: balance >= 0 ? t.success : t.danger }]}>
              {formatMoney(balance, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* 分类排行 */}
      {topCategories.length > 0 && (
        <View style={[styles.catSection, { borderTopColor: t.border }]}>
          <Text style={[styles.catTitle, { color: t.text }]}>分类构成</Text>
          {topCategories.slice(0, 5).map((cat, i) => {
            const pct = totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0;
            const isTop = i === 0;
            return (
              <View key={cat.name} style={[
                styles.catRow,
                isTop && { backgroundColor: t.primary + '08', borderRadius: 10, padding: 8, marginHorizontal: -8 },
              ]}>
                <Text style={[styles.catRank, { color: isTop ? t.primary : t.textMuted }]}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={[styles.catName, { color: t.text }]}>{cat.name}</Text>
                <View style={[styles.catBarBg, { backgroundColor: t.border }]}>
                  <View style={[styles.catBar, { width: pct + '%', backgroundColor: cat.color }]} />
                </View>
                <Text style={[styles.catAmount, { color: t.text }]}>
                  {formatMoney(cat.amount, currency)}
                </Text>
                <Text style={[styles.catPct, { color: t.textMuted }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 底部 */}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Text style={[styles.footerText, { color: t.textMuted }]}>由 小璐记账 生成</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 540,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  periodText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  badge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  dataCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataItem: {
    flex: 1,
    alignItems: 'center',
  },
  dataDivider: {
    width: 1,
    height: 36,
  },
  dataLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  catSection: {
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  catTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  catRank: {
    fontSize: 12,
    fontWeight: '600',
    width: 20,
    fontVariant: ['tabular-nums'],
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: '500',
    width: 48,
  },
  catBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  catBar: {
    height: '100%',
    borderRadius: 2.5,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '600',
    width: 72,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  catPct: {
    fontSize: 11,
    width: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  footer: {
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

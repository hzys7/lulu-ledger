// 小璐记账 · 分享卡片（Stripe 风格）
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../utils/currency';

// 分享图自带一套固定配色（不跟随 App 设置），风格与 App 的 Stripe 风格保持一致
const THEMES = {
  light: {
    bg: '#F6F9FC',
    cardBg: '#FFFFFF',
    primary: '#635BFF',
    accent: '#0EA5C4',
    text: '#0A2540',
    textSecondary: '#425466',
    textMuted: '#697386',
    border: '#E6EBF1',
    track: '#E9EEF4',
    success: '#1EA672',
    danger: '#DF1B41',
    shadowDark: '#0A2540',
    badgeText: '#FFFFFF',
  },
  dark: {
    bg: '#082032',
    cardBg: '#0E2E4A',
    primary: '#7A73FF',
    accent: '#4DD8F0',
    text: '#E8EEF5',
    textSecondary: '#C0CEDC',
    textMuted: '#93A8BE',
    border: '#1C3C5A',
    track: '#0A2135',
    success: '#4ADE9B',
    danger: '#FF8095',
    shadowDark: '#000000',
    badgeText: '#0A1F33',
  },
};

// Stripe 风格：白卡 + 1px 细边框 + 向下柔和投影
function raised(t, offset = 2, radius = 8, elevation = 2) {
  return {
    backgroundColor: t.cardBg,
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: t.shadowDark,
    shadowOffset: { width: 0, height: offset },
    shadowOpacity: 0.08,
    shadowRadius: radius,
    elevation,
  };
}

// 内嵌通道：浅灰底 + 1px 边框
function inset(t) {
  return {
    backgroundColor: t.track,
    borderWidth: 1,
    borderColor: t.border,
  };
}

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
    <View style={[styles.card, { backgroundColor: t.bg, shadowColor: t.shadowDark }]}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={[styles.periodText, { color: t.text }]}>{periodLabel}</Text>
        <View style={[styles.badge, { backgroundColor: t.primary }]}>
          <Text style={[styles.badgeText, { color: t.badgeText }]}>{topLabel}报告</Text>
        </View>
      </View>

      {/* 核心数据 */}
      <View style={[styles.dataCard, raised(t)]}>
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
                <View style={[styles.catBarBg, inset(t)]}>
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
    borderRadius: 14,
    padding: 28,
    paddingTop: 32,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
    fontWeight: '600',
  },

  dataCard: {
    borderRadius: 20,
    padding: 18,
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
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBar: {
    height: '100%',
    borderRadius: 4,
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

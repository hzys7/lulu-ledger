// 小璐记账 · 分享卡片（新拟物 / Soft UI）
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../utils/currency';

// 分享图自带一套固定配色（不跟随 App 设置），但风格与 App 的新拟物保持一致
const THEMES = {
  light: {
    bg: '#E0E5EC',
    cardBg: '#E0E5EC',
    primary: '#6D5DFC',
    accent: '#4ECDC4',
    text: '#333A45',
    textSecondary: '#525A66',
    textMuted: '#7C8593',
    border: 'rgba(184, 188, 194, 0.55)',
    track: '#D2D9E3',
    success: '#2E9E6B',
    danger: '#E5675F',
    shadowDark: '#B8BCC2',
    shadowLight: '#FFFFFF',
    badgeText: '#FFFFFF',
  },
  dark: {
    bg: '#2A2D35',
    cardBg: '#2A2D35',
    primary: '#8B7DFF',
    accent: '#4ECDC4',
    text: '#E4E7EC',
    textSecondary: '#C2C8D2',
    textMuted: '#8A92A0',
    border: 'rgba(0, 0, 0, 0.35)',
    track: '#1F2229',
    success: '#4CC38A',
    danger: '#F0837C',
    shadowDark: '#212429',
    shadowLight: '#33373F',
    badgeText: '#13141A',
  },
};

// 新拟物近似（RN 无双重/内阴影）：凸起只保留左上高光 + 右下柔和投影
function raised(t, offset = 6, radius = 16, elevation = 6) {
  return {
    backgroundColor: t.cardBg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: t.shadowLight,
    borderLeftColor: t.shadowLight,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    shadowColor: t.shadowDark,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 0.6,
    shadowRadius: radius,
    elevation,
  };
}

// 凹陷：左上压暗 + 右下提亮 + 更深的底色
function inset(t) {
  return {
    backgroundColor: t.track,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: t.shadowDark,
    borderLeftColor: t.shadowDark,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: t.shadowLight,
    borderRightColor: t.shadowLight,
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
    borderRadius: 24,
    padding: 28,
    paddingTop: 32,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
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

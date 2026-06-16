// 小璐记账 · 分享卡片（美化版）
// 精美的账单图片，支持分享到社交媒体
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../utils/currency';

// 精选配色方案
const THEMES = {
  light: {
    bg: '#FFFFFF',
    cardBg: '#F8FAFC',
    headerBg: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    primary: '#667EEA',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    success: '#059669',
    danger: '#DC2626',
  },
  dark: {
    bg: '#1E1E2E',
    cardBg: '#2A2A3C',
    headerBg: 'linear-gradient(135deg, #818CF8 0%, #A78BFA 100%)',
    primary: '#818CF8',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    success: '#34D399',
    danger: '#F87171',
  },
};

export default function ShareCard({
  period,
  year,
  month,
  weekLabel,
  totalIncome,
  totalExpense,
  balance,
  topCategories,
  dataType,
  currency,
  theme = 'light',
}) {
  const t = THEMES[theme] || THEMES.light;
  const periodLabel = period === 'week' ? weekLabel
    : period === 'month' ? `${year}年${month + 1}月`
    : `${year}年度`;

  const topLabel = dataType === 'expense' ? '支出' : '收入';
  const totalAmount = dataType === 'expense' ? totalExpense : totalIncome;
  const avgDaily = totalAmount / (period === 'week' ? 7 : period === 'month' ? 30 : 365);

  return (
    <View style={[styles.card, { backgroundColor: t.bg }]}>
      {/* 渐变头部 */}
      <View style={[styles.header, { backgroundColor: t.primary }]}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={styles.appName}>小璐记账</Text>
          <Text style={styles.periodText}>{periodLabel}</Text>
          <Text style={styles.reportType}>{topLabel}报告</Text>
        </View>
      </View>

      {/* 核心数据卡片 */}
      <View style={[styles.dataCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <View style={[styles.dataIcon, { backgroundColor: t.success + '20' }]}>
              <Text style={styles.dataIconText}>↑</Text>
            </View>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>收入</Text>
            <Text style={[styles.dataValue, { color: t.success }]}>
              {formatMoney(totalIncome, currency)}
            </Text>
          </View>
          <View style={[styles.dataDivider, { backgroundColor: t.border }]} />
          <View style={styles.dataItem}>
            <View style={[styles.dataIcon, { backgroundColor: t.danger + '20' }]}>
              <Text style={styles.dataIconText}>↓</Text>
            </View>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>支出</Text>
            <Text style={[styles.dataValue, { color: t.danger }]}>
              {formatMoney(totalExpense, currency)}
            </Text>
          </View>
          <View style={[styles.dataDivider, { backgroundColor: t.border }]} />
          <View style={styles.dataItem}>
            <View style={[styles.dataIcon, { backgroundColor: (balance >= 0 ? t.success : t.danger) + '20' }]}>
              <Text style={styles.dataIconText}>{balance >= 0 ? '=' : '!'}</Text>
            </View>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>结余</Text>
            <Text style={[styles.dataValue, { color: balance >= 0 ? t.success : t.danger }]}>
              {formatMoney(balance, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* 日均消费 */}
      <View style={[styles.avgCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <Text style={[styles.avgLabel, { color: t.textSecondary }]}>日均{topLabel}</Text>
        <Text style={[styles.avgValue, { color: t.text }]}>
          {formatMoney(avgDaily, currency)}
        </Text>
      </View>

      {/* 分类排行 */}
      {topCategories.length > 0 && (
        <View style={styles.catSection}>
          <Text style={[styles.catTitle, { color: t.text }]}>
            {topLabel}排行 TOP {Math.min(topCategories.length, 5)}
          </Text>
          {topCategories.slice(0, 5).map((cat, i) => {
            const pct = totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0;
            const isTop = i === 0;
            return (
              <View key={cat.name} style={[styles.catRow, isTop && { backgroundColor: t.cardBg, borderRadius: 12, padding: 8 }]}>
                <View style={[styles.catRank, { backgroundColor: isTop ? t.primary : t.textMuted }]}>
                  <Text style={styles.catRankText}>{i + 1}</Text>
                </View>
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
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    padding: 32,
    paddingTop: 28,
    paddingBottom: 24,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  periodText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 6,
  },
  reportType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 4,
  },

  dataCard: {
    marginHorizontal: 20,
    marginTop: -12,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
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
    height: 48,
    marginHorizontal: 8,
  },
  dataIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dataIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  avgCard: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  avgLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  avgValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  catSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  catTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  catRank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: '500',
    width: 56,
  },
  catBarBg: {
    flex: 1,
    height: 6,
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
    width: 80,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  catPct: {
    fontSize: 11,
    width: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 11,
  },
});

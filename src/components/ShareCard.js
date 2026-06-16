// 小璐记账 · 分享卡片（精美版）
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../utils/currency';

const THEMES = {
  light: {
    bg: '#FFFFFF',
    cardBg: '#F8FAFC',
    primary: '#667EEA',
    accent: '#764BA2',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    success: '#059669',
    danger: '#DC2626',
    successBg: '#ECFDF5',
    dangerBg: '#FEF2F2',
  },
  dark: {
    bg: '#1E1E2E',
    cardBg: '#2A2A3C',
    primary: '#818CF8',
    accent: '#A78BFA',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    success: '#34D399',
    danger: '#F87171',
    successBg: '#064E3B',
    dangerBg: '#450A0A',
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
        <View style={styles.headerPattern}>
          {/* 装饰圆圈 */}
          <View style={[styles.decoCircle, styles.deco1, { backgroundColor: t.accent }]} />
          <View style={[styles.decoCircle, styles.deco2, { backgroundColor: t.accent }]} />
          <View style={[styles.decoCircle, styles.deco3, { backgroundColor: t.accent }]} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.appIcon}>📊</Text>
          <Text style={styles.appName}>小璐记账</Text>
          <Text style={styles.periodText}>{periodLabel}</Text>
          <View style={styles.reportBadge}>
            <Text style={styles.reportBadgeText}>{topLabel}报告</Text>
          </View>
        </View>
      </View>

      {/* 核心数据卡片 */}
      <View style={[styles.dataCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <View style={[styles.dataIconWrap, { backgroundColor: t.successBg }]}>
              <Text style={styles.dataIcon}>📈</Text>
            </View>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>收入</Text>
            <Text style={[styles.dataValue, { color: t.success }]}>
              {formatMoney(totalIncome, currency)}
            </Text>
          </View>
          <View style={[styles.dataDivider, { backgroundColor: t.border }]} />
          <View style={styles.dataItem}>
            <View style={[styles.dataIconWrap, { backgroundColor: t.dangerBg }]}>
              <Text style={styles.dataIcon}>📉</Text>
            </View>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>支出</Text>
            <Text style={[styles.dataValue, { color: t.danger }]}>
              {formatMoney(totalExpense, currency)}
            </Text>
          </View>
          <View style={[styles.dataDivider, { backgroundColor: t.border }]} />
          <View style={styles.dataItem}>
            <View style={[styles.dataIconWrap, { backgroundColor: (balance >= 0 ? t.successBg : t.dangerBg) }]}>
              <Text style={styles.dataIcon}>{balance >= 0 ? '💰' : '⚠️'}</Text>
            </View>
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>结余</Text>
            <Text style={[styles.dataValue, { color: balance >= 0 ? t.success : t.danger }]}>
              {formatMoney(balance, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* 统计卡片行 */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={[styles.statLabel, { color: t.textSecondary }]}>日均{topLabel}</Text>
          <Text style={[styles.statValue, { color: t.text }]}>{formatMoney(avgDaily, currency)}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          <Text style={styles.statIcon}>🎯</Text>
          <Text style={[styles.statLabel, { color: t.textSecondary }]}>{topLabel}笔数</Text>
          <Text style={[styles.statValue, { color: t.text }]}>{topCategories.length} 类</Text>
        </View>
      </View>

      {/* 分类排行 */}
      {topCategories.length > 0 && (
        <View style={[styles.catSection, { borderTopColor: t.border }]}>
          <View style={styles.catHeader}>
            <Text style={[styles.catTitle, { color: t.text }]}>
              {topLabel}排行
            </Text>
            <Text style={[styles.catSubtitle, { color: t.textMuted }]}>
              TOP {Math.min(topCategories.length, 5)}
            </Text>
          </View>
          {topCategories.slice(0, 5).map((cat, i) => {
            const pct = totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0;
            const isTop = i === 0;
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <View key={cat.name} style={[
                styles.catRow,
                isTop && { backgroundColor: t.primary + '10', borderRadius: 12, padding: 10, paddingVertical: 12 },
              ]}>
                <Text style={styles.catMedal}>{medals[i] || `${i + 1}`}</Text>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <View style={styles.catInfo}>
                  <Text style={[styles.catName, { color: t.text }]}>{cat.name}</Text>
                  <View style={[styles.catBarBg, { backgroundColor: t.border }]}>
                    <View style={[styles.catBar, { width: pct + '%', backgroundColor: cat.color }]} />
                  </View>
                </View>
                <View style={styles.catRight}>
                  <Text style={[styles.catAmount, { color: t.text }]}>
                    {formatMoney(cat.amount, currency)}
                  </Text>
                  <Text style={[styles.catPct, { color: t.textMuted }]}>{pct}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 底部 */}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Text style={[styles.footerText, { color: t.textMuted }]}>✨ 由 小璐记账 生成</Text>
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  header: {
    padding: 32,
    paddingTop: 36,
    paddingBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  headerPattern: {
    ...StyleSheet.absoluteFillObject,
  },
  decoCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  deco1: {
    width: 200,
    height: 200,
    top: -80,
    right: -60,
  },
  deco2: {
    width: 150,
    height: 150,
    bottom: -50,
    left: -40,
  },
  deco3: {
    width: 100,
    height: 100,
    top: 40,
    left: 60,
    opacity: 0.1,
  },
  headerContent: {
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  appIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  appName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  periodText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.2,
    marginTop: 8,
  },
  reportBadge: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  reportBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  dataCard: {
    marginHorizontal: 20,
    marginTop: -16,
    borderRadius: 18,
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
    height: 52,
    marginHorizontal: 6,
  },
  dataIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dataIcon: {
    fontSize: 16,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  catSection: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  catTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  catSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  catMedal: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  catBarBg: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  catBar: {
    height: '100%',
    borderRadius: 2.5,
  },
  catRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  catPct: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  footer: {
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

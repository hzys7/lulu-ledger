// 小璐记账 · 汇总卡片组件（v1.6.4 修复图标遮挡）
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '../../theme';

const screenWidth = Dimensions.get('window').width;

export function SummaryCell({ tc, label, amount, amountColor, icon, iconBg, iconColor }) {
  return (
    <View style={styles.summaryCell}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <View style={[styles.summaryIconWrap, { backgroundColor: iconBg || '#F5F3FF' }]}>
          <Ionicons name={icon || 'wallet'} size={14} color={iconColor || '#7C5CFF'} />
        </View>
      </View>
      <Text style={[styles.summaryAmount, { color: amountColor || '#0F172A' }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
    </View>
  );
}

export function MonthSummaryGrid({ tc, selectedMonth, dataType, totalAmount, dailyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell
        label={`${selectedMonth + 1}月${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)}
        icon="wallet" iconBg="#F5F3FF" iconColor="#7C5CFF"
      />
      <SummaryCell
        label={`日均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)}
        icon="calculator" iconBg="#F0FDFA" iconColor="#0891B2"
      />
      <SummaryCell
        label={`比上月${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? '#DC2626' : '#34D399'}
        icon="trending-down" iconBg="#FEF2F2" iconColor="#34D399"
      />
      <SummaryCell
        label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? '#34D399' : '#DC2626'}
        icon="card" iconBg="#FEF2F2" iconColor="#EF4444"
      />
    </View>
  );
}

export function WeekSummaryGrid({ tc, dataType, totalAmount, dailyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell
        label={`本周${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)}
        icon="wallet" iconBg="#F5F3FF" iconColor="#7C5CFF"
      />
      <SummaryCell
        label={`日均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)}
        icon="calculator" iconBg="#F0FDFA" iconColor="#0891B2"
      />
      <SummaryCell
        label={`比上周${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? '#DC2626' : '#34D399'}
        icon="trending-down" iconBg="#FEF2F2" iconColor="#34D399"
      />
      <SummaryCell
        label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? '#34D399' : '#DC2626'}
        icon="card" iconBg="#FEF2F2" iconColor="#EF4444"
      />
    </View>
  );
}

export function YearSummaryGrid({ tc, dataType, reportYear, totalAmount, monthlyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell
        label={`${reportYear}年${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)}
        icon="wallet" iconBg="#F5F3FF" iconColor="#7C5CFF"
      />
      <SummaryCell
        label={`月均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? monthlyAvg.toFixed(2) : monthlyAvg.toFixed(0)}
        icon="calculator" iconBg="#F0FDFA" iconColor="#0891B2"
      />
      <SummaryCell
        label={`比去年${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? '#DC2626' : '#34D399'}
        icon="trending-down" iconBg="#FEF2F2" iconColor="#34D399"
      />
      <SummaryCell
        label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? '#34D399' : '#DC2626'}
        icon="card" iconBg="#FEF2F2" iconColor="#EF4444"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryCell: {
    width: (screenWidth - spacing.base * 2 - spacing.sm) / 2,
    padding: spacing.base,
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    ...shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: '#94A3B8',
    letterSpacing: -0.1,
    flex: 1,
  },
  summaryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryAmount: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
});

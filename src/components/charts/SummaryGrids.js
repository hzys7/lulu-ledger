// 小璐记账 · 汇总卡片组件（周/月/年报共用）
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '../../theme';

const screenWidth = Dimensions.get('window').width;

export function SummaryCell({ tc, label, amount, amountColor }) {
  return (
    <View style={[styles.summaryCell, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
      <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryAmount, { color: amountColor || tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
    </View>
  );
}

export function MonthSummaryGrid({ tc, selectedMonth, dataType, totalAmount, dailyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell tc={tc} label={`${selectedMonth + 1}月${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)} />
      <SummaryCell tc={tc} label={`日均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)} />
      <SummaryCell tc={tc} label={`比上月${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? tc.danger : tc.success} />
      <SummaryCell tc={tc} label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? tc.success : tc.danger} />
    </View>
  );
}

export function WeekSummaryGrid({ tc, dataType, totalAmount, dailyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell tc={tc} label={`本周${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)} />
      <SummaryCell tc={tc} label={`日均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)} />
      <SummaryCell tc={tc} label={`比上周${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? tc.danger : tc.success} />
      <SummaryCell tc={tc} label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? tc.success : tc.danger} />
    </View>
  );
}

export function YearSummaryGrid({ tc, dataType, reportYear, totalAmount, monthlyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell tc={tc} label={`${reportYear}年${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)} />
      <SummaryCell tc={tc} label={`月均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? monthlyAvg.toFixed(2) : monthlyAvg.toFixed(0)} />
      <SummaryCell tc={tc} label={`比去年${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? tc.danger : tc.success} />
      <SummaryCell tc={tc} label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? tc.success : tc.danger} />
    </View>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  summaryCell: {
    width: (screenWidth - spacing.base * 2 - spacing.sm) / 2,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
  },
  summaryAmount: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
});

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CategoryIcon } from './CategoryIcon';
import { spacing, fontSize, fontWeight } from '../theme';
import { formatMoney } from '../utils/currency';

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return '今天';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return '昨天';
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export const TransactionItem = memo(function TransactionItem({ transaction, onPress, currency = 'CNY', isLast }) {
  const isExpense = transaction.type === 'expense';
  const prefix = isExpense ? '-' : '+';

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <CategoryIcon category={transaction.category} type={transaction.type} size={42} />
      <View style={styles.info}>
        <Text style={styles.category} numberOfLines={1}>
          {transaction.category}
        </Text>
        {transaction.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>
          {prefix}{formatMoney(transaction.amount, transaction.currency || currency)}
        </Text>
        <Text style={styles.time}>{timeLabel(transaction.date)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 68,
    backgroundColor: '#FFFFFF',
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  category: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
    color: '#0F172A',
  },
  note: {
    fontSize: fontSize.sm,
    marginTop: 2,
    letterSpacing: -0.1,
    color: '#94A3B8',
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: '#0F172A',
  },
  time: {
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: -0.1,
    color: '#94A3B8',
  },
});

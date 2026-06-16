// 小璐记账 · 年度月度柱状图组件
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight } from '../../theme';

export default function YearMonthBarChart({ items, accent, muted, textMuted, text, divider }) {
  const values = items.map(i => i.value);
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barChartRow}>
      {items.map((d, i) => {
        const heightPct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <View key={i} style={styles.barCol}>
            <Text style={[styles.barValue, { color: textMuted }]}>
              {d.value > 0 ? (d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : Math.round(d.value)) : ''}
            </Text>
            {d.value > 0 ? (
              <View
                style={[styles.bar, {
                  height: Math.max(heightPct * 0.8, 8),
                  backgroundColor: accent,
                  opacity: 0.6,
                  borderRadius: 3,
                }]}
              />
            ) : (
              <View style={[styles.barEmpty, { backgroundColor: divider || '#ddd' }]} />
            )}
            <Text style={[styles.barLabel, { color: textMuted }]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: spacing.md,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '60%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barEmpty: {
    width: '60%',
    height: 2,
    borderRadius: 1,
    opacity: 0.3,
  },
  barValue: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});

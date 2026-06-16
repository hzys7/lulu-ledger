// 璐璐记账 · 柱状图对比行组件
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, fontSize, fontWeight } from '../../theme';

export default function BarChartRow({ items, accent, muted, divider, textMuted, text, selectedKey, onSelect }) {
  const values = items.map(i => i.value);
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barChartRow}>
      {items.map((d, i) => {
        const key = d.year + '_' + (d.month || '');
        const isSelected = selectedKey === key;
        const heightPct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <TouchableOpacity
            key={key}
            activeOpacity={0.7}
            style={styles.barCol}
            onPress={() => onSelect && onSelect(d)}
          >
            <Text style={[styles.barValue, { color: isSelected ? text : textMuted }]}>
              {d.value > 0 ? (d.value >= 1000 ? (Math.round(d.value / 100) / 10 + 'k') : Math.round(d.value)) : ''}
            </Text>
            {d.value > 0 ? (
              <View
                style={[styles.bar, {
                  height: Math.max(heightPct * 0.8, 8),
                  backgroundColor: accent,
                  opacity: isSelected ? 1 : 0.35,
                  borderRadius: isSelected ? 4 : 3,
                }]}
              />
            ) : (
              <View style={[styles.barEmpty, { backgroundColor: divider }]} />
            )}
            <Text style={[styles.barLabel, { color: isSelected ? text : muted, fontWeight: isSelected ? '600' : '400' }]}>
              {d.label}
            </Text>
          </TouchableOpacity>
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

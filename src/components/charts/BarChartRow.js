// 基于 GiftedCharts 的柱状图对比行组件
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { spacing } from '../../theme';

export default function BarChartRow({ items, accent, muted, divider, textMuted, text, selectedKey, onSelect }) {
  const chartData = useMemo(() => {
    return items.map(d => {
      const key = d.year + '_' + (d.month || '');
      const isSelected = key === selectedKey;
      return {
        value: d.value,
        label: d.label || '',
        frontColor: isSelected ? accent : (accent + '88'),
        key,
        originalItem: d,
      };
    });
  }, [items, accent, selectedKey]);

  const maxValue = useMemo(() => {
    const max = Math.max(...items.map(d => d.value), 1);
    return Math.ceil(max * 1.15);
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <BarChart
        data={chartData}
        width={300}
        height={150}
        maxValue={maxValue}
        noOfSections={3}
        barWidth={Math.min(32, Math.max(20, (280 - items.length * 6) / items.length))}
        spacing={items.length > 6 ? 6 : 10}
        initialSpacing={10}
        yAxisThickness={0}
        xAxisThickness={0}
        hideYAxisText
        hideRules
        isAnimated
        animationDuration={500}
        barBorderRadius={4}
        showValuesAsTopLabel
        topLabelTextStyle={{
          color: textMuted,
          fontSize: 9,
          fontWeight: '500',
        }}
        onPress={(item) => {
          if (item && item.originalItem && onSelect) {
            onSelect(item.originalItem);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
});

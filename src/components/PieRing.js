// 基于 GiftedCharts 的环形图
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { fontSize } from '../theme';

const PieRing = memo(function PieRing({
  data,
  size = 180,
  thickness = 28,
  center = null,
  selectedIndex = null,
  onSegmentPress,
}) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  if (total === 0) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={[styles.emptyText, { color: '#999' }]}>{'暂无数据'}</Text>
      </View>
    );
  }

  const radius = size / 2 - 2;
  const innerRadius = Math.max(radius - thickness, 0);

  const pieData = data.map((d) => ({
    value: d.value,
    color: d.color,
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <PieChart
        data={pieData}
        donut
        radius={radius}
        innerRadius={innerRadius}
        innerCircleColor="transparent"
        showText={false}
        selectedIndex={selectedIndex}
        onPress={(_item, index) => onSegmentPress?.(index)}
        backgroundColor="transparent"
        strokeWidth={0}
      />
      {center && (
        <View
          style={[styles.center, { width: size, height: size }]}
          pointerEvents="none"
        >
          {center}
        </View>
      )}
    </View>
  );
});

export default PieRing;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: fontSize.sm },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

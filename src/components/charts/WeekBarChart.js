// 小璐记账 · 周内每日柱状图组件
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import { spacing, fontSize, fontWeight, borderRadius } from '../../theme';
import { useNeu, useThemeColors } from '../../hooks/useThemeColors';

const screenWidth = Dimensions.get('window').width;

export default function WeekBarChart({ data, accent, muted }) {
  const neu = useNeu();
  const tc = useThemeColors();
  const width = screenWidth - spacing.base * 4;
  const height = 140;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const barWidth = (width - data.length * 6) / data.length;
  const labelY = height - 24;

  return (
    <View style={[styles.weekWrap, { height, alignItems: 'center' }, neu.inset]}>
      <Svg width={width} height={labelY}>
        {data.map((d, i) => {
          const barH = max > 0 ? (d.value / max) * (labelY - 12) : 4;
          const x = i * (barWidth + 6);
          const y = labelY - 8 - barH;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx={3}
                ry={3}
                fill={d.value > 0 ? tc.palette[i % tc.palette.length] : accent}
                opacity={d.value > 0 ? 0.85 : 0.2}
              />
            </G>
          );
        })}
      </Svg>
      {/* 标签渲染在 SVG 外部 */}
      <View style={styles.weekBarLabels}>
        {data.map((d, i) => (
          <View key={i} style={{ width: barWidth, alignItems: 'center', marginHorizontal: 3 }}>
            {d.value > 0 ? (
              <Text style={[styles.weekBarValue, { color: muted }]}>
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : Math.round(d.value)}
              </Text>
            ) : null}
            <Text style={[styles.weekBarLabel, { color: muted }]}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekWrap: {
    width: '100%',
    borderRadius: borderRadius.md,
  },
  weekBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 4,
  },
  weekBarValue: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  weekBarLabel: {
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
});

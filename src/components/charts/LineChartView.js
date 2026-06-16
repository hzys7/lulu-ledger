// 璐璐记账 · 折线图组件
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, G } from 'react-native-svg';
import { spacing, fontSize, fontWeight } from '../../theme';

const screenWidth = Dimensions.get('window').width;
const CHART_WIDTH = screenWidth - spacing.base * 2 - spacing.base * 2;
const CHART_HEIGHT = 140;
const PADDING = { top: 16, right: 8, bottom: 22, left: 8 };
const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

export default function LineChartView({ data, accent, muted, divider, selectedDay, onSelectDay }) {
  if (!data || data.length === 0) return null;

  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const stepX = data.length > 1 ? INNER_W / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PADDING.left + i * stepX;
    const y = PADDING.top + INNER_H - (d.value / max) * INNER_H;
    return { x, y, v: d.value, day: d.day };
  });

  let maxIdx = 0;
  values.forEach((v, i) => { if (v > values[maxIdx]) maxIdx = i; });

  const polylinePoints = points.map(p => p.x + ',' + p.y).join(' ');

  const labels = [];
  if (data.length > 0) {
    labels.push({ x: PADDING.left, label: data[0].label || '1' });
    if (data.length > 2) {
      const midIdx = Math.floor(data.length / 2);
      labels.push({ x: PADDING.left + INNER_W / 2, label: data[midIdx].label || String(midIdx + 1) });
    }
    labels.push({ x: PADDING.left + INNER_W, label: data[data.length - 1].label || String(data.length) });
  }

  const selIdx = selectedDay ? data.findIndex(d => d.day === selectedDay) : -1;
  const selPoint = selIdx >= 0 ? points[selIdx] : null;

  return (
    <View>
      <View
        style={{ width: CHART_WIDTH, height: CHART_HEIGHT }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(evt) => {
          const x = evt.nativeEvent.locationX;
          if (stepX <= 0) return;
          const idx = Math.round((x - PADDING.left) / stepX);
          const clamped = Math.max(0, Math.min(data.length - 1, idx));
          onSelectDay && onSelectDay(data[clamped] ? data[clamped].day : null);
        }}
      >
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {[0.25, 0.5, 0.75].map((p, i) => (
            <Line
              key={'g' + i}
              x1={PADDING.left} y1={PADDING.top + INNER_H * p}
              x2={PADDING.left + INNER_W} y2={PADDING.top + INNER_H * p}
              stroke={divider} strokeWidth={1} strokeDasharray="2,4"
            />
          ))}
          <Polyline
            points={polylinePoints}
            fill="none" stroke={accent} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
          />
          {points.map((p, i) => (
            values[i] > 0 ? <Circle key={'p' + i} cx={p.x} cy={p.y} r={2.5} fill={accent} /> : null
          ))}
          {values[maxIdx] > 0 && <Circle cx={points[maxIdx].x} cy={points[maxIdx].y} r={4} fill={accent} />}
          {selPoint && values[selIdx] > 0 && (
            <G>
              <Line
                x1={selPoint.x} y1={PADDING.top}
                x2={selPoint.x} y2={PADDING.top + INNER_H}
                stroke={accent} strokeWidth={1} strokeDasharray="2,3" opacity={0.5}
              />
              <Circle cx={selPoint.x} cy={selPoint.y} r={5} fill={accent} stroke="#FFFFFF" strokeWidth={2} />
            </G>
          )}
        </Svg>
      </View>
      <View style={styles.lineLabels}>
        {labels.map((l, i) => (
          <Text key={i} style={[styles.lineLabel, { color: muted }]}>{l.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: 2,
  },
  lineLabel: {
    fontSize: fontSize.xs,
    fontVariant: ['tabular-nums'],
  },
});

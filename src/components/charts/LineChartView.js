// 小璐记账 · 折线图组件（升级版）
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, G, Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { spacing, fontSize, fontWeight } from '../../theme';

const screenWidth = Dimensions.get('window').width;
const CHART_WIDTH = screenWidth - spacing.base * 2 - spacing.base * 2;
const CHART_HEIGHT = 160;
const PADDING = { top: 20, right: 12, bottom: 24, left: 36 };
const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

function niceNum(value) {
  if (value <= 0) return 100;
  const exp = Math.floor(Math.log10(value));
  const frac = value / Math.pow(10, exp);
  let nice;
  if (frac <= 1.5) nice = 1;
  else if (frac <= 3) nice = 2;
  else if (frac <= 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

function getNiceScale(maxVal) {
  const niceMax = niceNum(maxVal);
  const step = niceNum(niceMax / 4);
  const ticks = [];
  for (let v = 0; v <= niceMax + step * 0.01; v += step) {
    ticks.push(v);
  }
  return { max: niceMax, ticks };
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function LineChartView({ data, accent, muted, divider, selectedDay, onSelectDay }) {
  if (!data || data.length === 0) return null;

  const values = data.map(d => d.value);
  const maxRaw = Math.max(...values, 1);
  const { max, ticks } = useMemo(() => getNiceScale(maxRaw), [maxRaw]);
  const avg = useMemo(() => {
    const sum = values.reduce((a, b) => a + b, 0);
    return values.length > 0 ? sum / values.length : 0;
  }, [values]);
  const stepX = data.length > 1 ? INNER_W / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PADDING.left + i * stepX;
    const y = PADDING.top + INNER_H - (d.value / max) * INNER_H;
    return { x, y, v: d.value, day: d.day };
  });

  let maxIdx = 0;
  values.forEach((v, i) => { if (v > values[maxIdx]) maxIdx = i; });

  const linePath = smoothPath(points);
  const areaPath = linePath
    ? `${linePath} L${points[points.length - 1].x},${PADDING.top + INNER_H} L${points[0].x},${PADDING.top + INNER_H} Z`
    : '';

  const labels = [];
  if (data.length > 0) {
    const interval = data.length <= 10 ? 1 : data.length <= 15 ? 3 : 5;
    for (let i = 0; i < data.length; i += interval) {
      labels.push({ x: PADDING.left + i * stepX, label: String(data[i].day) });
    }
    const lastDay = data[data.length - 1].day;
    if (labels[labels.length - 1].label !== String(lastDay)) {
      labels.push({ x: PADDING.left + (data.length - 1) * stepX, label: String(lastDay) });
    }
  }

  const selIdx = selectedDay ? data.findIndex(d => d.day === selectedDay) : -1;
  const selPoint = selIdx >= 0 ? points[selIdx] : null;
  const avgY = PADDING.top + INNER_H - (avg / max) * INNER_H;

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
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity={0.25} />
              <Stop offset="1" stopColor={accent} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {ticks.map((v, i) => {
            const y = PADDING.top + INNER_H - (v / max) * INNER_H;
            return (
              <G key={'ytick' + i}>
                <Line
                  x1={PADDING.left} y1={y}
                  x2={PADDING.left + INNER_W} y2={y}
                  stroke={divider} strokeWidth={1} strokeDasharray="2,4"
                />
                <Text
                  x={PADDING.left - 4} y={y + 3}
                  fontSize={9} fill={muted} textAnchor="end"
                  fontVariant={['tabular-nums']}
                >
                  {v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)}
                </Text>
              </G>
            );
          })}

          {avg > 0 && (
            <G>
              <Line
                x1={PADDING.left} y1={avgY}
                x2={PADDING.left + INNER_W} y2={avgY}
                stroke={accent} strokeWidth={1} strokeDasharray="4,3" opacity={0.4}
              />
              <Text
                x={PADDING.left + INNER_W + 2} y={avgY + 3}
                fontSize={8} fill={accent} opacity={0.6}
              >
                均
              </Text>
            </G>
          )}

          {areaPath ? (
            <Path d={areaPath} fill="url(#areaGrad)" />
          ) : null}

          {linePath ? (
            <Path
              d={linePath}
              fill="none" stroke={accent} strokeWidth={2.2}
              strokeLinejoin="round" strokeLinecap="round"
            />
          ) : null}

          {points.map((p, i) => (
            values[i] > 0 ? (
              <Circle key={'p' + i} cx={p.x} cy={p.y} r={2} fill={accent} />
            ) : null
          ))}
          {values[maxIdx] > 0 && (
            <Circle cx={points[maxIdx].x} cy={points[maxIdx].y} r={4.5} fill={accent} />
          )}
          {selPoint && values[selIdx] > 0 && (
            <G>
              <Line
                x1={selPoint.x} y1={PADDING.top}
                x2={selPoint.x} y2={PADDING.top + INNER_H}
                stroke={accent} strokeWidth={1} strokeDasharray="2,3" opacity={0.5}
              />
              <Circle cx={selPoint.x} cy={selPoint.y} r={6} fill={accent} />
              <Circle cx={selPoint.x} cy={selPoint.y} r={3} fill="#FFFFFF" />

              <Rect
                x={selPoint.x - 32} y={selPoint.y - 32}
                width={64} height={24} rx={6}
                fill={accent}
              />
              <Text
                x={selPoint.x} y={selPoint.y - 16}
                fontSize={10} fill="#FFFFFF" textAnchor="middle"
                fontWeight={600} fontVariant={['tabular-nums']}
              >
                {selPoint.v >= 1000 ? (selPoint.v / 1000).toFixed(1) + 'k' : selPoint.v.toFixed(0)}
              </Text>
            </G>
          )}
        </Svg>
      </View>
      <View style={styles.lineLabels}>
        {labels.map((l, i) => (
          <Text key={i} style={[styles.lineLabel, { color: muted, position: 'absolute', left: l.x - 8 }]}>{l.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lineLabels: {
    height: 16,
    marginTop: 2,
  },
  lineLabel: {
    fontSize: fontSize.xs,
    fontVariant: ['tabular-nums'],
  },
});

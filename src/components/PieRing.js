// 手画环形图
// props: data = [{ value, color }], size, thickness, center (React node)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { fontSize, fontWeight, getThemeColors } from '../theme';
import { useFinance } from '../context/FinanceContext';

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const startOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    'M', startOuter.x, startOuter.y,
    'A', rOuter, rOuter, 0, largeArcFlag, 1, endOuter.x, endOuter.y,
    'L', startInner.x, startInner.y,
    'A', rInner, rInner, 0, largeArcFlag, 0, endInner.x, endInner.y,
    'Z',
  ].join(' ');
}

export default function PieRing({ data, size = 180, thickness = 28, center = null }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={[styles.emptyText, { color: tc.textMuted }]}>{'暂无数据'}</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - thickness;

  const gapDeg = data.length > 1 ? 1.5 : 0;

  let cursor = 0;
  const arcs = data.map((d, i) => {
    const pct = d.value / total;
    const sweep = pct * 360;
    const startAngle = cursor + gapDeg / 2;
    const endAngle = cursor + sweep - gapDeg / 2;
    cursor += sweep;
    return { d, startAngle, endAngle, key: i };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G>
          {arcs.map(({ d, startAngle, endAngle, key }) => {
            if (endAngle - startAngle <= 0) return null;
            const path = arcPath(cx, cy, rOuter, rInner, startAngle, endAngle);
            return <Path key={key} d={path} fill={d.color} />;
          })}
        </G>
      </Svg>
      {center ? (
        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          {center}
        </View>
      ) : null}
    </View>
  );
}

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

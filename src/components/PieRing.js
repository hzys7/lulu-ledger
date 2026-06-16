// 手画环形图
// props: data = [{ value, color }], size, thickness, center (React node)
//         selectedIndex, onSegmentPress (支持点击高亮)
import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, G, Circle, Defs, ClipPath } from 'react-native-svg';
import { fontSize } from '../theme';

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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PieRing = memo(function PieRing({
  data,
  size = 180,
  thickness = 28,
  center = null,
  selectedIndex = null,
  onSegmentPress,
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  // ── 入场动画 ────────────────────────────────────────────
  // Ref 初始值固定为 0（隐藏），避免空→有数据时闪现全图
  const revealR = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(0)).current;
  // 唯一 clip id，避免多个 PieRing 冲突
  const clipId = useRef(
    `pie-reveal-${Math.random().toString(36).slice(2, 9)}`
  ).current;

  useEffect(() => {
    if (total === 0) return;
    // 首次有数据或有数据时触发一次绽放
    revealR.setValue(0);
    centerOpacity.setValue(0);

    Animated.timing(revealR, {
      toValue: size * 0.75,
      duration: 600,
      useNativeDriver: false,
    }).start();

    Animated.timing(centerOpacity, {
      toValue: 1,
      duration: 350,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, [total > 0]);

  if (total === 0) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={[styles.emptyText, { color: '#999' }]}>{'暂无数据'}</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - thickness;
  const trackR = rOuter - thickness / 2;

  // 多个色块时使用更大间隙 + 背景轨道，单色块时保持简洁
  const hasMultiple = data.length > 1;
  const gapDeg = hasMultiple ? 2.5 : 0;

  let cursor = 0;
  const arcs = data.map((d, i) => {
    const pct = d.value / total;
    const sweep = pct * 360;
    const startAngle = cursor + gapDeg / 2;
    const endAngle = cursor + sweep - gapDeg / 2;
    cursor += sweep;
    return { d, startAngle, endAngle, key: i, index: i };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id={clipId}>
            {/* 径向绽放的裁剪圆 */}
            <AnimatedCircle cx={cx} cy={cy} r={revealR} />
          </ClipPath>
        </Defs>

        {/* 背景轨道 + 色块统一被裁剪，实现从中心绽放 */}
        <G clipPath={`url(#${clipId})`}>
          {hasMultiple && (
            <Circle
              cx={cx}
              cy={cy}
              r={trackR}
              fill="none"
              stroke="rgba(128,128,128,0.07)"
              strokeWidth={thickness + 2}
            />
          )}
          {arcs.map(({ d, startAngle, endAngle, key, index }) => {
            if (endAngle - startAngle <= 0) return null;

            const isSelected = selectedIndex === index;
            const isDimmed = selectedIndex !== null && !isSelected;

            const glowAmt = isSelected ? Math.min(thickness * 0.12, 3) : 0;
            const rOuterAdj = rOuter + glowAmt;
            const rInnerAdj = rInner - glowAmt;

            const path = arcPath(cx, cy, rOuterAdj, rInnerAdj, startAngle, endAngle);

            return (
              <G key={key}>
                {isSelected && (
                  <Path
                    d={arcPath(cx, cy, rOuter + 3, rInner - 3, startAngle, endAngle)}
                    fill={d.color}
                    opacity={0.25}
                    stroke="none"
                  />
                )}
                <Path
                  d={path}
                  fill={d.color}
                  stroke="rgba(0,0,0,0.08)"
                  strokeWidth={0.5}
                  opacity={isDimmed ? 0.3 : 1}
                  onPress={() => onSegmentPress?.(index)}
                />
              </G>
            );
          })}
        </G>
      </Svg>

      {/* 中心文字淡入 */}
      {center ? (
        <Animated.View
          style={[
            styles.center,
            { width: size, height: size, opacity: centerOpacity },
          ]}
          pointerEvents="none"
        >
          {center}
        </Animated.View>
      ) : null}
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

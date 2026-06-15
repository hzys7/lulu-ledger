import React, { memo } from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { spacing, borderRadius, shadows } from '../theme';

// 一张干净的实心卡：用于"高级"信息的展示（如概览卡）。不再使用渐变光晕。
export const GradientCard = memo(function GradientCard({ children, style, onPress, dark = false, padded = true }) {
  const tc = useThemeColors();

  const bg = dark ? tc.primary : tc.surface;
  const fg = dark ? tc.primaryOn : tc.text;
  const shadow = dark ? shadows.md : shadows.sm;

  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.card,
        { backgroundColor: bg, ...shadow },
        padded && { padding: spacing.lg },
        style,
      ]}
    >
      {typeof children === 'string'
        ? <Text style={[styles.text, { color: fg }]}>{children}</Text>
        : children}
    </Component>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  text: { fontSize: 14 },
});

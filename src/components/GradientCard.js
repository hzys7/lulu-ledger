import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { spacing, borderRadius, shadows, getThemeColors } from '../theme';
import { useFinance } from '../context/FinanceContext';

// 一张干净的实心卡：用于"高级"信息的展示（如概览卡）。不再使用渐变光晕。
export function GradientCard({ children, style, onPress, dark = false, padded = true }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

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
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  text: { fontSize: 14 },
});

import React, { memo } from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, fontWeight } from '../theme';

export const EmptyState = memo(function EmptyState({ icon = 'wallet-outline', title, subtitle, compact = false }) {
  const tc = useThemeColors();
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={[styles.iconWrap, { backgroundColor: tc.surfaceMuted }]}>
        <Ionicons name={icon} size={26} color={tc.textSubtle} />
      </View>
      <Text style={[styles.title, { color: tc.text }]}>{title || '暂无数据'}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: tc.textMuted }]}>{subtitle}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  compact: { paddingVertical: spacing.xl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});

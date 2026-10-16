import React, { memo } from 'react';
import { useThemeColors, useNeu } from '../hooks/useThemeColors';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, fontWeight } from '../theme';

export const EmptyState = memo(function EmptyState({ icon = 'wallet-outline', title, subtitle, compact = false }) {
  const tc = useThemeColors();
  const neu = useNeu();
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={[styles.iconWrap, neu.inset]}>
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
    width: 64,
    height: 64,
    borderRadius: 32,
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

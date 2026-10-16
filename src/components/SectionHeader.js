import React, { memo } from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight } from '../theme';

export const SectionHeader = memo(function SectionHeader({ title, subtitle, action, onAction, style }) {
  const tc = useThemeColors();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: tc.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: tc.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.actionText, { color: tc.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  left: { flex: 1 },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  action: {
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },
});

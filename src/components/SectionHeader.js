import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, fontSize, fontWeight, getThemeColors } from '../theme';
import { useFinance } from '../context/FinanceContext';

export function SectionHeader({ title, subtitle, action, onAction, style }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: tc.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: tc.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} style={styles.action} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.actionText, { color: tc.text }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  action: { paddingLeft: spacing.md, paddingVertical: spacing.xs },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },
});

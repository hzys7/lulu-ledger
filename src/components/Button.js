import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors } from '../theme';
import { useFinance } from '../context/FinanceContext';

export function Button({ title, onPress, variant = 'primary', icon, style, disabled, loading }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  const variants = {
    primary: { bg: tc.primary, text: tc.primaryOn, border: tc.primary },
    secondary: { bg: tc.surface, text: tc.text, border: tc.border },
    ghost: { bg: 'transparent', text: tc.textSecondary, border: 'transparent' },
    danger: { bg: tc.danger, text: tc.white, border: tc.danger },
  };
  const v = variants[variant] || variants.primary;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0 },
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={v.text} style={styles.icon} />}
          <Text style={[styles.buttonText, { color: v.text }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  icon: { marginRight: spacing.sm },
});

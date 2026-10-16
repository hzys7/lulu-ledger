import React, { memo, useState, useCallback } from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

// Stripe 风格按钮：实色主色 + 同色系柔和投影；次级为白底细边框；按下轻微下压
export const Button = memo(function Button({ title, onPress, variant = 'primary', icon, style, disabled, loading }) {
  const tc = useThemeColors();
  const [pressed, setPressed] = useState(false);

  const solidShadow = (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: pressed ? 0.18 : 0.28,
    shadowRadius: 6,
    elevation: pressed ? 1 : 2,
  });

  const variants = {
    primary: {
      bg: pressed ? tc.primaryHover : tc.primary,
      text: tc.primaryOn,
      extra: solidShadow(tc.primary),
    },
    secondary: {
      bg: pressed ? tc.surfaceMuted : tc.card,
      text: tc.text,
      extra: { borderWidth: 1, borderColor: tc.borderStrong, shadowOpacity: 0, elevation: 0 },
    },
    ghost: {
      bg: 'transparent',
      text: pressed ? tc.text : tc.textSecondary,
      extra: { borderWidth: 0, shadowOpacity: 0, elevation: 0 },
    },
    danger: {
      bg: pressed ? '#C4162F' : tc.danger,
      text: tc.white,
      extra: solidShadow(tc.danger),
    },
  };
  const v = variants[variant] || variants.primary;

  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: v.bg, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
        v.extra,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={v.text} style={styles.icon} />}
          <Text style={[styles.buttonText, { color: v.text }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
});

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
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  icon: { marginRight: spacing.sm },
});

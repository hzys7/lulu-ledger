import React, { memo, useState, useCallback } from 'react';
import { useThemeColors, useNeu } from '../hooks/useThemeColors';
import { Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

// 新拟物按钮：默认凸起，按下转为凹陷（不使用位移，元素“长”在背景上）
export const Button = memo(function Button({ title, onPress, variant = 'primary', icon, style, disabled, loading }) {
  const tc = useThemeColors();
  const neu = useNeu();
  const [pressed, setPressed] = useState(false);

  const solidShadow = (color) => ({
    shadowColor: color,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: pressed ? 0.25 : 0.4,
    shadowRadius: pressed ? 6 : 12,
    elevation: pressed ? 3 : 6,
  });

  const variants = {
    primary: {
      bg: pressed ? tc.primaryHover : tc.primary,
      text: tc.primaryOn,
      extra: solidShadow(tc.primary),
    },
    secondary: {
      text: pressed ? tc.textSecondary : tc.text,
      extra: pressed ? neu.pressed : neu.raisedSm,
    },
    ghost: {
      bg: 'transparent',
      text: pressed ? tc.text : tc.textSecondary,
      extra: { borderWidth: 0, shadowOpacity: 0, elevation: 0, backgroundColor: 'transparent' },
    },
    danger: {
      bg: pressed ? '#D65B54' : tc.danger,
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
        v.bg ? { backgroundColor: v.bg } : null,
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

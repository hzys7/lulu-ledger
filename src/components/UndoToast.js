// 璐璐记账 · 撤销删除 Toast
// 浮动在屏幕底部，显示「已删除」+「撤销」按钮，5 秒后自动消失
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

export default function UndoToast({ visible, message, onUndo, onTimeout, duration = 5000 }) {
  const tc = useThemeColors();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // 滑入
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
      // 自动消失计时
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onTimeout?.());
      }, duration);
    } else {
      // 隐藏
      if (timerRef.current) clearTimeout(timerRef.current);
      opacity.setValue(0);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: tc.surface,
          borderColor: tc.border,
          bottom: insets.bottom + 90,
          opacity,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 6,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.left}>
        <Ionicons name="checkmark-circle" size={18} color={tc.textMuted} />
        <Text style={[styles.message, { color: tc.text }]}>{message}</Text>
      </View>
      <TouchableOpacity
        style={[styles.undoBtn, { backgroundColor: tc.primarySubtle }]}
        onPress={onUndo}
        activeOpacity={0.7}
      >
        <Text style={[styles.undoText, { color: tc.primary }]}>撤销</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },
  undoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  undoText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },
});

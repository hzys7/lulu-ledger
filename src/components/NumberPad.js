import React from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

export function NumberPad({ onInput, onDelete, onConfirm, style, confirmLabel = '确定' }) {
  const tc = useThemeColors();

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'back'],
  ];

  return (
    <View style={style}>
      {keys.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((k) => {
            const isBack = k === 'back';
            return (
              <TouchableOpacity
                key={k}
                style={[styles.key, { backgroundColor: tc.surface }]}
                onPress={() => (isBack ? onDelete?.() : onInput?.(k))}
                activeOpacity={0.55}
              >
                {isBack ? (
                  <Ionicons name="backspace-outline" size={20} color={tc.text} />
                ) : (
                  <Text style={[styles.keyText, { color: tc.text }]}>{k}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <TouchableOpacity
        style={[styles.confirm, { backgroundColor: tc.primary }]}
        onPress={onConfirm}
        activeOpacity={0.85}
      >
        <Text style={[styles.confirmText, { color: tc.primaryOn }]}>{confirmLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  confirm: {
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  confirmText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
});

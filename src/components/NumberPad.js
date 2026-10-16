// 数字键盘组件 - 独立渲染，避免父组件 re-render
// 新拟物：按键默认凸起，按下转为凹陷
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useNeu } from '../hooks/useThemeColors';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

export default function NumberPad({ onInput, onDelete, tc: tcProp }) {
  const tcHook = useThemeColors();
  const tc = tcProp || tcHook;
  const neu = useNeu();
  const [pressedKey, setPressedKey] = useState(null);

  const handlePressIn = useCallback((key) => {
    setPressedKey(key);
  }, []);

  const handlePressOut = useCallback(() => {
    setPressedKey(null);
  }, []);

  const handlePress = useCallback((key) => {
    if (key === 'del') {
      onDelete();
    } else {
      onInput(key);
    }
  }, [onInput, onDelete]);

  return (
    <View style={styles.keypad}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.keypadRow}>
          {row.map((k, ki) => {
            const isDel = k === 'del';
            const isLast = ki === row.length - 1;
            const isPressed = pressedKey === k;
            return (
              <Pressable
                key={k}
                style={[
                  styles.keypadKey,
                  !isLast && styles.keypadKeyGap,
                  isPressed ? neu.pressed : neu.raisedSm,
                ]}
                onPress={() => handlePress(k)}
                onPressIn={() => handlePressIn(k)}
                onPressOut={handlePressOut}
              >
                {isDel ? (
                  <Ionicons name="backspace-outline" size={20} color={tc.text} />
                ) : (
                  <Text style={[styles.keypadKeyText, { color: tc.text }]}>{k}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: {},
  keypadRow: { flexDirection: 'row', marginBottom: spacing.sm },
  keypadKey: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyGap: { marginRight: spacing.sm },
  keypadKeyText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
});

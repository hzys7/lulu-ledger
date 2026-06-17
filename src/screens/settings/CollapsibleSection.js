// CollapsibleSection: 可折叠的设置模块
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme';

export default function CollapsibleSection({ title, icon, iconColor, defaultExpanded = false, children, rightAction }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const animatedHeight = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    Animated.timing(animatedHeight, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const onLayout = (e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== contentHeight) {
      setContentHeight(h);
    }
  };

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 500],
  });

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <View style={[styles.iconWrap, { backgroundColor: (iconColor || tc.primary) + '15' }]}>
              <Ionicons name={icon} size={18} color={iconColor || tc.primary} />
            </View>
          )}
          <Text style={[styles.title, { color: tc.text }]}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          {rightAction}
          <Animated.View style={{ transform: [{ rotate: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '90deg'],
          }) }] }}>
            <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <View ref={contentRef} onLayout={onLayout}>
          <View style={styles.content}>
            {children}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  content: {
    paddingTop: spacing.sm,
  },
});

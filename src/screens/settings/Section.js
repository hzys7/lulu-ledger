// Section / ActionRow: small presentational building blocks used by every
// SettingsScreen section. Extracted verbatim from the old monolithic file.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing, neuStyles } from '../../theme';
import { styles } from './styles';

function Section({ title, rightAction, children }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: tc.textMuted }]}>{title}</Text>
        {rightAction}
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function ActionRow({ icon, iconColor, iconBg, label, onPress, rightIcon }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const neu = useMemo(() => neuStyles(tc), [tc]);
  return (
    <TouchableOpacity
      style={[styles.listItem, neu.raisedSm]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.listIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.listContent}>
        <Text style={[styles.listTitle, { color: tc.text }]}>{label}</Text>
      </View>
      {rightIcon ? <Ionicons name={rightIcon} size={16} color={tc.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export { Section, ActionRow };
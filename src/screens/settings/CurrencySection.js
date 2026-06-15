// CurrencySection: single row, opens the (parent-owned) currency modal.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { Section } from './Section';
import { styles } from './styles';

function CurrencySection({ onOpenModal }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="货币设置">
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onOpenModal}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons name="globe-outline" size={18} color={tc.text} />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>默认货币</Text>
        </View>
        <View style={styles.rightMeta}>
          <Text style={[styles.rightText, { color: tc.textMuted }]}>{settings.currency}</Text>
          <Ionicons name="chevron-forward" size={16} color={tc.textSubtle} />
        </View>
      </TouchableOpacity>
    </Section>
  );
}

export default CurrencySection;
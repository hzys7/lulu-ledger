// AboutSection: app name + version row. Version is read from expo-constants
// (same source the old monolithic file used).
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { hexAlpha } from './_shared';
import { Section } from './Section';
import { styles } from './styles';

function AboutSection() {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const version =
    Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';
  return (
    <Section title="关于">
      <View style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}>
        <View style={[styles.listIcon, { backgroundColor: hexAlpha(tc.accent, 0.12) }]}>
          <Ionicons name="sparkles" size={18} color={tc.accent} />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>小璐记账</Text>
        </View>
        <Text style={[styles.rightText, { color: tc.textMuted }]}>{version}</Text>
      </View>
    </Section>
  );
}

export default AboutSection;
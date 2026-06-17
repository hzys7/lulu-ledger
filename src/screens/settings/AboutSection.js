// AboutSection: 关于（可折叠）
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import CollapsibleSection from './CollapsibleSection';

function AboutSection() {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const version =
    Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

  return (
    <CollapsibleSection
      title="关于"
      icon="information-circle-outline"
      iconColor="#8E8E93"
    >
      <View style={[styles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: '#6C63FF' + '15' }]}>
          <Ionicons name="wallet" size={18} color="#6C63FF" />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: tc.text }]}>小璐记账</Text>
          <Text style={[styles.rowHint, { color: tc.textMuted }]}>
            AI 智能记账 APP
          </Text>
        </View>
        <Text style={[styles.rowValue, { color: tc.textMuted }]}>v{version}</Text>
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowHint: {
    fontSize: 12,
    marginTop: 1,
  },
  rowValue: {
    fontSize: 13,
  },
});

export default AboutSection;

// BudgetSection: single row that navigates to the Budget screen.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, fontWeight } from '../../theme';
import { hexAlpha } from './_shared';
import { Section } from './Section';
import { styles } from './styles';

function BudgetSection({ onNavigate }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="预算管理">
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onNavigate}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: hexAlpha('#F59E0B', 0.12) }]}>
          <Ionicons name="pie-chart" size={18} color="#F59E0B" />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>月度预算</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            设置各分类的月度预算上限
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tc.textSubtle} />
      </TouchableOpacity>
    </Section>
  );
}

export default BudgetSection;
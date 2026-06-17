// BudgetSection: 预算管理（可折叠）
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import CollapsibleSection from './CollapsibleSection';

function BudgetSection({ onNavigate }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  return (
    <CollapsibleSection
      title="预算管理"
      icon="pie-chart-outline"
      iconColor="#FF9F0A"
    >
      <TouchableOpacity
        style={[styles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onNavigate}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#FF9F0A' + '15' }]}>
          <Ionicons name="pie-chart" size={18} color="#FF9F0A" />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: tc.text }]}>月度预算</Text>
          <Text style={[styles.rowHint, { color: tc.textMuted }]}>
            设置各分类的月度预算上限
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
      </TouchableOpacity>
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
});

export default BudgetSection;

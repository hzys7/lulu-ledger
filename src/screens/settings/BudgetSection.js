// BudgetSection: 预算管理 - 简单行
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, neuStyles } from '../../theme';
import { Section } from './Section';
import { styles } from './styles';

function BudgetSection({ onNavigate }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const neu = useMemo(() => neuStyles(tc), [tc]);
  return (
    <Section title="预算管理">
      <TouchableOpacity
        style={[styles.listItem, neu.raisedSm]}
        onPress={onNavigate}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: '#FF9F0A' + '15' }]}>
          <Ionicons name="pie-chart" size={18} color="#FF9F0A" />
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

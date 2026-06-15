// StatsSection: three stat cards (total transactions, total income,
// total expense). All numbers are passed in by the parent.
import React from 'react';
import { View, Text } from 'react-native';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { formatMoney } from '../../utils/currency';
import { Section } from './Section';
import { styles } from './styles';

function StatsSection({ totalTxCount, totalIncome, totalExpense }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="数据统计">
      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <Text style={[styles.statLabel, { color: tc.textMuted }]}>总交易</Text>
          <Text style={[styles.statValue, { color: tc.text }]}>{totalTxCount}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <Text style={[styles.statLabel, { color: tc.textMuted }]}>总收入</Text>
          <Text style={[styles.statValue, { color: tc.text }]}>
            {formatMoney(totalIncome, settings.currency)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <Text style={[styles.statLabel, { color: tc.textMuted }]}>总支出</Text>
          <Text style={[styles.statValue, { color: tc.text }]}>
            {formatMoney(totalExpense, settings.currency)}
          </Text>
        </View>
      </View>
    </Section>
  );
}

export default StatsSection;
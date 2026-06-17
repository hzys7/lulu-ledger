// StatsSection: 数据统计（可折叠）
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { formatMoney } from '../../utils/currency';
import CollapsibleSection from './CollapsibleSection';

function StatsSection({ totalTxCount, totalIncome, totalExpense }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  return (
    <CollapsibleSection
      title="数据统计"
      icon="bar-chart-outline"
      iconColor="#34C759"
    >
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#6C63FF' + '15' }]}>
            <Ionicons name="receipt-outline" size={16} color="#6C63FF" />
          </View>
          <Text style={[styles.statLabel, { color: tc.textMuted }]}>总交易</Text>
          <Text style={[styles.statValue, { color: tc.text }]}>{totalTxCount}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#34C759' + '15' }]}>
            <Ionicons name="arrow-down-outline" size={16} color="#34C759" />
          </View>
          <Text style={[styles.statLabel, { color: tc.textMuted }]}>总收入</Text>
          <Text style={[styles.statValue, { color: '#34C759' }]}>
            {formatMoney(totalIncome, settings.currency)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FF6B6B' + '15' }]}>
            <Ionicons name="arrow-up-outline" size={16} color="#FF6B6B" />
          </View>
          <Text style={[styles.statLabel, { color: tc.textMuted }]}>总支出</Text>
          <Text style={[styles.statValue, { color: '#FF6B6B' }]}>
            {formatMoney(totalExpense, settings.currency)}
          </Text>
        </View>
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
});

export default StatsSection;

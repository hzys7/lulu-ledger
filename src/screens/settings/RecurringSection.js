// RecurringSection: 周期性交易（可折叠）
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, fontWeight } from '../../theme';
import { formatMoney } from '../../utils/currency';
import CollapsibleSection from './CollapsibleSection';

function RecurringSection({ recurring, onAdd, onDelete }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  const rightAction = (
    <TouchableOpacity
      onPress={onAdd}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="add-circle-outline" size={20} color="#FF9F0A" />
    </TouchableOpacity>
  );

  return (
    <CollapsibleSection
      title="周期性交易"
      icon="repeat-outline"
      iconColor="#FF9F0A"
      rightAction={rightAction}
    >
      {recurring.length > 0 ? (
        recurring.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onLongPress={() => onDelete(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#FF9F0A' + '15' }]}>
              <Ionicons name="repeat" size={16} color="#FF9F0A" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: tc.text }]}>{item.category}</Text>
              <Text style={[styles.rowHint, { color: tc.textMuted }]}>
                {item.frequency === 'daily'
                  ? '每天'
                  : item.frequency === 'weekly'
                  ? '每周'
                  : item.frequency === 'monthly'
                  ? '每月'
                  : '每年'}
                {item.note ? ' · ' + item.note : ''}
              </Text>
            </View>
            <Text
              style={[
                styles.rowValue,
                { color: tc.text, fontWeight: fontWeight.semibold },
              ]}
            >
              {formatMoney(item.amount, item.currency)}
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <View
          style={[
            styles.emptyRow,
            { backgroundColor: tc.surface, borderColor: tc.border },
          ]}
        >
          <Ionicons name="time-outline" size={24} color={tc.textSubtle} />
          <Text style={[styles.emptyText, { color: tc.textMuted }]}>暂无周期性交易</Text>
          <Text style={[styles.emptyHint, { color: tc.textSubtle }]}>
            点击右上角 + 添加
          </Text>
        </View>
      )}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 12,
  },
});

export default RecurringSection;

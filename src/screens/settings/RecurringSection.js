// RecurringSection: list of recurring (template) transactions with a "+"
// action. The full form modal is owned by the parent.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, fontWeight } from '../../theme';
import { formatMoney } from '../../utils/currency';
import { Section } from './Section';
import { styles } from './styles';

function RecurringSection({ recurring, onAdd, onDelete }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section
      title="周期性交易"
      rightAction={
        <TouchableOpacity
          onPress={onAdd}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={22} color={tc.text} />
        </TouchableOpacity>
      }
    >
      {recurring.length > 0 ? (
        recurring.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onLongPress={() => onDelete(item.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
              <Ionicons name="repeat" size={18} color={tc.text} />
            </View>
            <View style={styles.listContent}>
              <Text style={[styles.listTitle, { color: tc.text }]}>{item.category}</Text>
              <Text style={[styles.listSub, { color: tc.textMuted }]}>
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
                styles.rightText,
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
            styles.listItem,
            {
              backgroundColor: tc.surface,
              borderColor: tc.border,
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={[styles.listSub, { color: tc.textMuted }]}>暂无周期性交易</Text>
        </View>
      )}
    </Section>
  );
}

export default RecurringSection;
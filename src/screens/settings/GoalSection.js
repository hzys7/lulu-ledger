// GoalSection: 消费目标入口
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme';
import { Section } from './Section';

function GoalSection({ navigation }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  return (
    <Section title="消费目标">
      <TouchableOpacity
        style={[styles.goalBtn, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={() => navigation.navigate('Goal')}
        activeOpacity={0.7}
      >
        <View style={[styles.goalIcon, { backgroundColor: tc.primarySubtle }]}>
          <Ionicons name="flag" size={20} color={tc.primary} />
        </View>
        <View style={styles.goalInfo}>
          <Text style={[styles.goalTitle, { color: tc.text }]}>管理消费目标</Text>
          <Text style={[styles.goalDesc, { color: tc.textMuted }]}>设定目标、追踪进度、获取 AI 建议</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
      </TouchableOpacity>
    </Section>
  );
}

const styles = {
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  goalDesc: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
};

export default GoalSection;

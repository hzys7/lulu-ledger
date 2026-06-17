// AiSection: AI 智能 - 简单行
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { Section, ActionRow } from './Section';

function AiSection({ onOpenModal }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  return (
    <Section title="AI 智能">
      <ActionRow
        icon="sparkles"
        iconColor="#AF52DE"
        iconBg="#AF52DE15"
        label="AI 配置"
        onPress={onOpenModal}
        rightIcon="chevron-forward"
      />
    </Section>
  );
}

export default AiSection;

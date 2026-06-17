// AiSection: AI 智能（可折叠）
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { ActionRow } from './Section';
import CollapsibleSection from './CollapsibleSection';

function AiSection({ onOpenModal }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  return (
    <CollapsibleSection
      title="AI 智能"
      icon="sparkles"
      iconColor="#AF52DE"
    >
      <ActionRow
        icon="sparkles"
        iconColor="#AF52DE"
        iconBg="#AF52DE15"
        label="AI 配置"
        onPress={onOpenModal}
        rightIcon="chevron-forward"
      />
    </CollapsibleSection>
  );
}

export default AiSection;

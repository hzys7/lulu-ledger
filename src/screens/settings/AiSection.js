// AiSection: single row that opens the AI configuration modal. The modal
// itself (AiSettingsScreen) is owned by the parent.
import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { hexAlpha } from './_shared';
import { Section, ActionRow } from './Section';
import { styles } from './styles';

function AiSection({ onOpenModal }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="AI 智能">
      <ActionRow
        icon="sparkles"
        iconColor={tc.accent}
        iconBg={hexAlpha(tc.accent, 0.12)}
        label="AI 配置"
        onPress={onOpenModal}
        rightIcon="chevron-forward"
      />
    </Section>
  );
}

export default AiSection;
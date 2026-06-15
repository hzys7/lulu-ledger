// DataSection: three rows for CSV export, JSON backup export, and import.
// The import modal is owned by the parent.
import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { Section, ActionRow } from './Section';
import { styles } from './styles';

function DataSection({ onExportCSV, onExportJSON, onOpenImportModal }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="数据管理">
      <ActionRow
        icon="document-text-outline"
        iconColor={tc.text}
        iconBg={tc.surfaceMuted}
        label="导出为 CSV"
        onPress={onExportCSV}
        rightIcon="download-outline"
      />
      <ActionRow
        icon="cloud-upload-outline"
        iconColor={tc.text}
        iconBg={tc.surfaceMuted}
        label="完整备份导出"
        onPress={onExportJSON}
        rightIcon="download-outline"
      />
      <ActionRow
        icon="download-outline"
        iconColor={tc.text}
        iconBg={tc.surfaceMuted}
        label="导入备份"
        onPress={onOpenImportModal}
      />
    </Section>
  );
}

export default DataSection;
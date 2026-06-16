// UpdateSection: auto-check toggle + manual check.
// Proxy toggle was removed (useProxy setting was dead code).
// All state lives in the parent SettingsScreen.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { Section } from './Section';
import { styles } from './styles';

function UpdateSection({
  isChecking,
  checkResult,
  checkResultText,
  onToggleAutoCheck,
  onCheckNow,
}) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="版本更新">
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onToggleAutoCheck}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons name="sync" size={18} color={tc.text} />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>自动检查更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {settings.autoCheckUpdate ? '进入首页时自动检查' : '需要手动检查'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <View
            style={[
              styles.toggleTrack,
              {
                backgroundColor: settings.autoCheckUpdate ? tc.primary : tc.surfaceMuted,
                justifyContent: settings.autoCheckUpdate ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View style={[styles.toggleThumb, { backgroundColor: '#fff' }]} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onCheckNow}
        activeOpacity={0.7}
        disabled={isChecking}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons
            name={isChecking ? 'sync' : 'cloud-download-outline'}
            size={18}
            color={tc.text}
          />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>检查更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {isChecking
              ? '正在检查…'
              : checkResult
              ? checkResultText(checkResult)
              : '点击检查新版本'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
        </View>
      </TouchableOpacity>
    </Section>
  );
}

export default UpdateSection;

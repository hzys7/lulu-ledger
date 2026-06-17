// UpdateSection: 版本更新（可折叠）
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import CollapsibleSection from './CollapsibleSection';

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
    <CollapsibleSection
      title="版本更新"
      icon="cloud-download-outline"
      iconColor="#007AFF"
    >
      <TouchableOpacity
        style={[styles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onToggleAutoCheck}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#007AFF' + '15' }]}>
          <Ionicons name="sync" size={18} color="#007AFF" />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: tc.text }]}>自动检查更新</Text>
          <Text style={[styles.rowHint, { color: tc.textMuted }]}>
            {settings.autoCheckUpdate ? '进入首页时自动检查' : '需要手动检查'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <View
            style={[
              styles.toggleTrack,
              {
                backgroundColor: settings.autoCheckUpdate ? '#007AFF' : tc.surfaceMuted,
                justifyContent: settings.autoCheckUpdate ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View style={[styles.toggleThumb, { backgroundColor: '#fff' }]} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onCheckNow}
        activeOpacity={0.7}
        disabled={isChecking}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#007AFF' + '15' }]}>
          <Ionicons
            name={isChecking ? 'sync' : 'cloud-download-outline'}
            size={18}
            color="#007AFF"
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: tc.text }]}>检查更新</Text>
          <Text style={[styles.rowHint, { color: tc.textMuted }]}>
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
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    marginTop: 1,
  },
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
});

export default UpdateSection;

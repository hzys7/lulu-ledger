// DataSection: 可折叠的数据管理模块
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing } from '../../theme';
import { ActionRow } from './Section';
import CollapsibleSection from './CollapsibleSection';
import {
  getAutoBackupSettings,
  shouldBackup,
  performAutoBackup,
  saveAutoBackupSettings,
  listAutoBackups,
} from '../../utils/autoBackup';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

function DataSection({ onExportCSV, onExportJSON, onOpenImportModal }) {
  const { settings, updateAppSettings } = useFinance();
  const tc = getThemeColors(settings.theme);

  const backupSettings = getAutoBackupSettings(settings);
  const [backupCount, setBackupCount] = useState(0);
  const [lastBackupDisplay, setLastBackupDisplay] = useState('');

  useEffect(() => {
    loadBackupInfo();
  }, [backupSettings.lastBackupTime]);

  const loadBackupInfo = async () => {
    const backups = await listAutoBackups();
    setBackupCount(backups.length);
    if (backupSettings.lastBackupTime) {
      const d = new Date(backupSettings.lastBackupTime);
      setLastBackupDisplay(`${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setLastBackupDisplay('未备份过');
    }
  };

  const handleToggleAutoBackup = async () => {
    const newEnabled = !backupSettings.enabled;
    await updateAppSettings({ autoBackupEnabled: newEnabled });

    if (newEnabled) {
      Alert.alert('自动备份', '已开启自动备份，将在下次满足条件时自动执行。');
    }
  };

  const handleChangeFrequency = async (freq) => {
    await updateAppSettings({ autoBackupFrequency: freq });
  };

  const handleBackupNow = async () => {
    Alert.alert('立即备份', '确定要立即执行自动备份吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '备份',
        onPress: async () => {
          const result = await performAutoBackup();
          if (result.success) {
            await loadBackupInfo();
            await updateAppSettings({ autoBackupLastTime: new Date().toISOString() });
            Alert.alert('备份成功', `已保存为 ${result.fileName}`);
          } else {
            Alert.alert('备份失败', result.reason || '未知错误');
          }
        },
      },
    ]);
  };

  const handleViewBackups = async () => {
    const backups = await listAutoBackups();
    if (backups.length === 0) {
      Alert.alert('备份列表', '暂无自动备份文件');
      return;
    }
    const list = backups.map((b, i) => {
      const name = b.name.replace('auto_backup_', '').replace('.json', '');
      const size = (b.size / 1024).toFixed(1);
      return `${i + 1}. ${name} (${size}KB)`;
    }).join('\n');
    Alert.alert(`自动备份 (${backups.length}个)`, list);
  };

  const backupSummary = backupSettings.enabled
    ? `已开启 · ${FREQUENCY_OPTIONS.find(f => f.value === backupSettings.frequency)?.label || '每周'}`
    : '未开启';

  return (
    <CollapsibleSection
      title="数据管理"
      icon="folder-open-outline"
      iconColor="#34C759"
    >
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

      {/* 自动备份开关 */}
      <TouchableOpacity
        style={[autoStyles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={handleToggleAutoBackup}
        activeOpacity={0.7}
      >
        <View style={[autoStyles.iconWrap, { backgroundColor: '#FF9F0A' + '15' }]}>
          <Ionicons name="time-outline" size={18} color="#FF9F0A" />
        </View>
        <View style={autoStyles.rowContent}>
          <Text style={[autoStyles.rowLabel, { color: tc.text }]}>自动备份</Text>
          <Text style={[autoStyles.rowHint, { color: tc.textMuted }]}>
            {backupSummary}
          </Text>
        </View>
        <Switch
          value={backupSettings.enabled}
          onValueChange={handleToggleAutoBackup}
          trackColor={{ false: tc.surfaceMuted, true: '#FF9F0A' }}
          thumbColor="#fff"
        />
      </TouchableOpacity>

      {/* 自动备份详情 */}
      {backupSettings.enabled && (
        <View style={[autoStyles.panel, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          {/* 频率选择 */}
          <Text style={[autoStyles.panelLabel, { color: tc.textMuted }]}>备份频率</Text>
          <View style={autoStyles.freqRow}>
            {FREQUENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  autoStyles.freqBtn,
                  { backgroundColor: tc.surfaceMuted, borderColor: tc.border },
                  backupSettings.frequency === opt.value && {
                    backgroundColor: '#FF9F0A',
                    borderColor: '#FF9F0A',
                  },
                ]}
                onPress={() => handleChangeFrequency(opt.value)}
              >
                <Text style={[
                  autoStyles.freqBtnText,
                  { color: tc.text },
                  backupSettings.frequency === opt.value && { color: '#fff' },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 备份信息 */}
          <View style={[autoStyles.infoRow, { borderTopColor: tc.border }]}>
            <Ionicons name="time-outline" size={14} color={tc.textMuted} />
            <Text style={[autoStyles.infoLabel, { color: tc.textMuted }]}>上次备份</Text>
            <Text style={[autoStyles.infoValue, { color: tc.text }]}>
              {lastBackupDisplay}
            </Text>
          </View>

          <View style={[autoStyles.infoRow, { borderTopColor: tc.border }]}>
            <Ionicons name="folder-outline" size={14} color={tc.textMuted} />
            <Text style={[autoStyles.infoLabel, { color: tc.textMuted }]}>已保存</Text>
            <Text style={[autoStyles.infoValue, { color: tc.text }]}>
              {backupCount}个备份
            </Text>
          </View>

          {/* 操作按钮 */}
          <View style={autoStyles.actionRow}>
            <TouchableOpacity
              style={[autoStyles.actionBtn, { backgroundColor: '#FF9F0A' }]}
              onPress={handleBackupNow}
            >
              <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
              <Text style={autoStyles.actionBtnText}>立即备份</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[autoStyles.actionBtn, { backgroundColor: tc.surfaceMuted }]}
              onPress={handleViewBackups}
            >
              <Ionicons name="list-outline" size={14} color={tc.text} />
              <Text style={[autoStyles.actionBtnText, { color: tc.text }]}>查看备份</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </CollapsibleSection>
  );
}

const autoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
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
  panel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
    marginBottom: spacing.xs,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  freqBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: {
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default DataSection;

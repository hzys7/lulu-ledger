// DataSection: 可折叠的数据管理模块
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing, neuStyles } from '../../theme';
import { ActionRow } from './Section';
import CollapsibleSection from './CollapsibleSection';
import BackupBrowserModal from './BackupBrowserModal';
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

function DataSection({ onExportCSV, onExportJSON, onOpenImportModal, onRestore }) {
  const { settings, updateAppSettings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const neu = useMemo(() => neuStyles(tc), [tc]);

  const backupSettings = getAutoBackupSettings(settings);
  const [backupCount, setBackupCount] = useState(0);
  const [lastBackupDisplay, setLastBackupDisplay] = useState('');
  const [showBackupBrowser, setShowBackupBrowser] = useState(false);

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

  const handleToggleAutoBackup = async (value) => {
    // 由外层显式传入目标状态
    const newEnabled = value !== undefined ? value : !backupSettings.enabled;
    console.log('[DataSection] Toggle auto backup:', newEnabled);
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

  const backupSummary = backupSettings.enabled
    ? `已开启 · ${FREQUENCY_OPTIONS.find(f => f.value === backupSettings.frequency)?.label || '每周'}`
    : '未开启';

  return (
    <>
      <CollapsibleSection
        title="数据管理"
        icon="folder-open-outline"
        iconColor={tc.success}
      >
        <ActionRow
          icon="document-text-outline"
          iconColor={tc.primary}
          iconBg={tc.primarySubtle}
          label="导出为 CSV"
          onPress={onExportCSV}
          rightIcon="download-outline"
        />
        <ActionRow
          icon="cloud-upload-outline"
          iconColor={tc.info}
          iconBg={tc.infoSubtle}
          label="完整备份导出"
          onPress={onExportJSON}
          rightIcon="download-outline"
        />
        <ActionRow
          icon="download-outline"
          iconColor={tc.success}
          iconBg={tc.successSubtle}
          label="导入备份"
          onPress={onOpenImportModal}
          rightIcon="enter-outline"
        />

        {/* 自动备份开关 */}
        <TouchableOpacity
          style={[autoStyles.row, neu.raisedSm]}
          onPress={() => handleToggleAutoBackup(!backupSettings.enabled)}
          activeOpacity={0.7}
        >
          <View style={[autoStyles.iconWrap, { backgroundColor: tc.warningSubtle }]}>
            <Ionicons name="time-outline" size={18} color={tc.warning} />
          </View>
          <View style={autoStyles.rowContent}>
            <Text style={[autoStyles.rowLabel, { color: tc.text }]}>自动备份</Text>
            <Text style={[autoStyles.rowHint, { color: tc.textMuted }]}>
              {backupSummary}
            </Text>
          </View>
          {/* 与其它设置项一致的新拟物开关（凹槽 + 滑块） */}
          <View
            style={[
              autoStyles.toggleTrack,
              neu.inset,
              { justifyContent: backupSettings.enabled ? 'flex-end' : 'flex-start' },
            ]}
          >
            <View style={[autoStyles.toggleThumb, { backgroundColor: tc.white }]} />
          </View>
        </TouchableOpacity>

        {/* 自动备份详情 */}
        {backupSettings.enabled && (
          <View style={[autoStyles.panel, neu.inset]}>
            {/* 频率选择 */}
            <Text style={[autoStyles.panelLabel, { color: tc.textMuted }]}>备份频率</Text>
            <View style={autoStyles.freqRow}>
              {FREQUENCY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    autoStyles.freqBtn,
                    neu.raisedSm,
                    backupSettings.frequency === opt.value && {
                      backgroundColor: tc.primary,
                      borderColor: tc.primary,
                    },
                  ]}
                  onPress={() => handleChangeFrequency(opt.value)}
                >
                  <Text style={[
                    autoStyles.freqBtnText,
                    { color: tc.text },
                    backupSettings.frequency === opt.value && { color: tc.primaryOn },
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
                style={[autoStyles.actionBtn, { backgroundColor: tc.primary, shadowColor: tc.primary, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }]}
                onPress={handleBackupNow}
              >
                <Ionicons name="cloud-upload-outline" size={14} color={tc.primaryOn} />
                <Text style={[autoStyles.actionBtnText, { color: tc.primaryOn }]}>立即备份</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[autoStyles.actionBtn, neu.raisedSm]}
                onPress={() => setShowBackupBrowser(true)}
              >
                <Ionicons name="list-outline" size={14} color={tc.text} />
                <Text style={[autoStyles.actionBtnText, { color: tc.text }]}>查看备份</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </CollapsibleSection>

      <BackupBrowserModal
        visible={showBackupBrowser}
        onClose={() => {
          setShowBackupBrowser(false);
          loadBackupInfo();
        }}
        onRestore={onRestore}
      />
    </>
  );
}

const autoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
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
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  panel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
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
    fontSize: 13,
    fontWeight: '500',
  },
});

export default DataSection;

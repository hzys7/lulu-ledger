// DataSection: CSV export, JSON backup, import, and auto backup settings.
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { Section, ActionRow } from './Section';
import { styles } from './styles';
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
  const [showBackupSettings, setShowBackupSettings] = useState(false);
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
    await saveAutoBackupSettings({ autoBackupEnabled: newEnabled });
    await updateAppSettings({ autoBackupEnabled: newEnabled });

    if (newEnabled && shouldBackup({ ...settings, autoBackupEnabled: true, autoBackupLastTime: null })) {
      Alert.alert('自动备份', '已开启自动备份，将在下次满足条件时自动执行。');
    }
  };

  const handleChangeFrequency = async (freq) => {
    await saveAutoBackupSettings({ autoBackupFrequency: freq });
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

  const tc2 = tc;

  return (
    <Section title="数据管理">
      <ActionRow
        icon="document-text-outline"
        iconColor={tc2.text}
        iconBg={tc2.surfaceMuted}
        label="导出为 CSV"
        onPress={onExportCSV}
        rightIcon="download-outline"
      />
      <ActionRow
        icon="cloud-upload-outline"
        iconColor={tc2.text}
        iconBg={tc2.surfaceMuted}
        label="完整备份导出"
        onPress={onExportJSON}
        rightIcon="download-outline"
      />
      <ActionRow
        icon="download-outline"
        iconColor={tc2.text}
        iconBg={tc2.surfaceMuted}
        label="导入备份"
        onPress={onOpenImportModal}
      />

      {/* 自动备份设置 */}
      <TouchableOpacity
        style={[autoStyles.header, { borderTopColor: tc2.border }]}
        onPress={() => setShowBackupSettings(!showBackupSettings)}
        activeOpacity={0.7}
      >
        <View style={autoStyles.headerLeft}>
          <View style={[autoStyles.iconCircle, { backgroundColor: tc2.surfaceMuted }]}>
            <Text style={[autoStyles.icon, { color: tc2.text }]}>⏰</Text>
          </View>
          <Text style={[autoStyles.label, { color: tc2.text }]}>自动备份</Text>
        </View>
        <View style={autoStyles.headerRight}>
          <Text style={[autoStyles.status, { color: tc2.textSecondary }]}>
            {backupSettings.enabled ? '已开启' : '已关闭'}
          </Text>
        </View>
      </TouchableOpacity>

      {showBackupSettings && (
        <View style={[autoStyles.panel, { backgroundColor: tc2.surface }]}>
          {/* 开关 */}
          <View style={[autoStyles.row, { borderBottomColor: tc2.border }]}>
            <Text style={[autoStyles.rowLabel, { color: tc2.text }]}>启用自动备份</Text>
            <Switch
              value={backupSettings.enabled}
              onValueChange={handleToggleAutoBackup}
              trackColor={{ false: tc2.surfaceMuted, true: '#6C63FF' }}
              thumbColor="#fff"
            />
          </View>

          {/* 备份频率 */}
          {backupSettings.enabled && (
            <>
              <View style={[autoStyles.row, { borderBottomColor: tc2.border }]}>
                <Text style={[autoStyles.rowLabel, { color: tc2.text }]}>备份频率</Text>
              </View>
              <View style={autoStyles.freqRow}>
                {FREQUENCY_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      autoStyles.freqBtn,
                      { backgroundColor: tc2.surfaceMuted, borderColor: tc2.border },
                      backupSettings.frequency === opt.value && {
                        backgroundColor: '#6C63FF',
                        borderColor: '#6C63FF',
                      },
                    ]}
                    onPress={() => handleChangeFrequency(opt.value)}
                  >
                    <Text style={[
                      autoStyles.freqBtnText,
                      { color: tc2.text },
                      backupSettings.frequency === opt.value && { color: '#fff' },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 备份信息 */}
              <View style={[autoStyles.row, { borderBottomColor: tc2.border }]}>
                <Text style={[autoStyles.rowLabel, { color: tc2.text }]}>上次备份</Text>
                <Text style={[autoStyles.rowValue, { color: tc2.textSecondary }]}>
                  {lastBackupDisplay}
                </Text>
              </View>

              <View style={[autoStyles.row, { borderBottomColor: tc2.border }]}>
                <Text style={[autoStyles.rowLabel, { color: tc2.text }]}>已保存备份</Text>
                <Text style={[autoStyles.rowValue, { color: tc2.textSecondary }]}>
                  {backupCount}个
                </Text>
              </View>

              {/* 操作按钮 */}
              <View style={autoStyles.actionRow}>
                <TouchableOpacity
                  style={[autoStyles.actionBtn, { backgroundColor: '#6C63FF' }]}
                  onPress={handleBackupNow}
                >
                  <Text style={autoStyles.actionBtnText}>立即备份</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[autoStyles.actionBtn, { backgroundColor: tc2.surfaceMuted }]}
                  onPress={handleViewBackups}
                >
                  <Text style={[autoStyles.actionBtnText, { color: tc2.text }]}>查看备份</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </Section>
  );
}

const autoStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 15,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  status: {
    fontSize: 13,
  },
  panel: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 13,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DataSection;

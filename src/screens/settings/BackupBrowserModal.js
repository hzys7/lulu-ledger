// BackupBrowserModal: 备份文件浏览器
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme';
import { listAutoBackups, readBackupFile, deleteBackup } from '../../utils/autoBackup';

export default function BackupBrowserModal({ visible, onClose, onRestore }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    if (visible) loadBackups();
  }, [visible]);

  const loadBackups = async () => {
    setLoading(true);
    const list = listAutoBackups();
    setBackups(list);
    setLoading(false);
  };

  const handleRestore = (backup) => {
    Alert.alert(
      '恢复备份',
      `确定要恢复 ${backup.name} 吗？\n\n当前数据将被覆盖。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '恢复',
          style: 'destructive',
          onPress: async () => {
            try {
              setRestoring(backup.name);
              const result = await readBackupFile(backup.uri);
              if (result.success && result.data) {
                const { importData } = await import('../../utils/storage');
                await importData(result.data, 'replace');
                Alert.alert('恢复成功', '数据已恢复，请刷新页面');
                if (onRestore) await onRestore();
                onClose();
              } else {
                Alert.alert('恢复失败', result.reason || '未知错误');
              }
            } catch (e) {
              Alert.alert('恢复失败', e.message || '未知错误');
            } finally {
              setRestoring(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (backup) => {
    Alert.alert(
      '删除备份',
      `确定要删除 ${backup.name} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteBackup(backup.name);
            loadBackups();
          },
        },
      ]
    );
  };

  const formatDate = (name) => {
    // auto_backup_20260617_1218.json -> 2026-06-17 12:18
    const match = name.match(/auto_backup_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\.json/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
    }
    return name;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderItem = ({ item }) => {
    const isRestoring = restoring === item.name;
    return (
      <View style={[styles.item, { backgroundColor: tc.surface, borderColor: tc.border }]}>
        <View style={[styles.itemIcon, { backgroundColor: '#34C759' + '15' }]}>
          <Ionicons name="document-text-outline" size={20} color="#34C759" />
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: tc.text }]} numberOfLines={1}>
            {formatDate(item.name)}
          </Text>
          <Text style={[styles.itemSize, { color: tc.textMuted }]}>
            {formatSize(item.size)}
          </Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: tc.primary + '15' }]}
            onPress={() => handleRestore(item)}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={tc.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={16} color={tc.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#FF6B6B' + '15' }]}
            onPress={() => handleDelete(item)}
            disabled={isRestoring}
          >
            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.handle, { backgroundColor: tc.divider }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: tc.text }]}>自动备份文件</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tc.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={tc.primary} />
            </View>
          ) : backups.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={48} color={tc.textSubtle} />
              <Text style={[styles.emptyText, { color: tc.textMuted }]}>暂无自动备份</Text>
              <Text style={[styles.emptyHint, { color: tc.textSubtle }]}>
                开启自动备份后，备份文件会显示在这里
              </Text>
            </View>
          ) : (
            <FlatList
              data={backups}
              keyExtractor={(item) => item.name}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.base,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  list: {
    paddingBottom: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  itemSize: {
    fontSize: fontSize.xs,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});

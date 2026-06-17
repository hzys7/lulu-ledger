// FilePickerModal: 自定义文件选择器，列出可导入的备份文件
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Directory, File, Paths } from 'expo-file-system';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme';

export default function FilePickerModal({ visible, onClose, onSelect }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) loadFiles();
  }, [visible]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const fileList = [];
      
      // 列出文档目录中的 JSON 和 CSV 文件
      const docDir = new Directory(Paths.document);
      if (docDir.exists) {
        const items = docDir.list();
        for (const item of items) {
          if (item instanceof File) {
            if (item.name.endsWith('.json') || item.name.endsWith('.csv')) {
              fileList.push({
                name: item.name,
                uri: item.uri,
                size: item.size,
                type: item.name.endsWith('.json') ? 'json' : 'csv',
                date: getFileDate(item.name),
              });
            }
          }
        }
      }

      // 也列出 backups 子目录
      const backupDir = new Directory(Paths.document, 'backups');
      if (backupDir.exists) {
        const items = backupDir.list();
        for (const item of items) {
          if (item instanceof File) {
            if (item.name.endsWith('.json') || item.name.endsWith('.csv')) {
              fileList.push({
                name: item.name,
                uri: item.uri,
                size: item.size,
                type: item.name.endsWith('.json') ? 'json' : 'csv',
                date: getFileDate(item.name),
                isBackup: true,
              });
            }
          }
        }
      }

      // 按日期排序
      fileList.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setFiles(fileList);
    } catch (e) {
      console.warn('[FilePicker] Load failed:', e);
    }
    setLoading(false);
  };

  const getFileDate = (name) => {
    // 尝试从文件名提取日期
    const match = name.match(/(\d{4})(\d{2})(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return '';
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSelect = async (file) => {
    try {
      const f = new File(file.uri);
      const text = f.text();
      onSelect({ name: file.name, text });
      onClose();
    } catch (e) {
      console.warn('[FilePicker] Read failed:', e);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: tc.surface, borderColor: tc.border }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.itemIcon, { backgroundColor: item.type === 'json' ? '#6C63FF' + '15' : '#34C759' + '15' }]}>
        <Ionicons
          name={item.type === 'json' ? 'code-outline' : 'document-text-outline'}
          size={20}
          color={item.type === 'json' ? '#6C63FF' : '#34C759'}
        />
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: tc.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.itemMeta, { color: tc.textMuted }]}>
          {item.date && item.date + ' · '}{formatSize(item.size)}
          {item.isBackup ? ' · 自动备份' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.handle, { backgroundColor: tc.divider }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: tc.text }]}>选择文件</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tc.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: tc.textMuted }]}>
            选择要导入的 JSON 或 CSV 文件
          </Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={tc.primary} />
            </View>
          ) : files.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={48} color={tc.textSubtle} />
              <Text style={[styles.emptyText, { color: tc.textMuted }]}>未找到可导入的文件</Text>
              <Text style={[styles.emptyHint, { color: tc.textSubtle }]}>
                导出的备份文件会显示在这里
              </Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.uri}
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
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
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
  itemMeta: {
    fontSize: fontSize.xs,
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

// ImportModal: 导入备份 - 直接显示文件列表
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Directory, File, Paths } from 'expo-file-system';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, fontSize, spacing, borderRadius, fontWeight } from '../../theme';
import { styles } from './styles';

function ImportModal({ visible, onClose, importJson, setImportJson, onImport }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

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
          if (item.name && item.size !== undefined && typeof item.size === 'number') {
            if (item.name.endsWith('.json') || item.name.endsWith('.csv')) {
              fileList.push({
                name: item.name,
                uri: item.uri,
                size: item.size,
                type: item.name.endsWith('.json') ? 'json' : 'csv',
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
          if (item.name && item.size !== undefined && typeof item.size === 'number') {
            if (item.name.endsWith('.json') || item.name.endsWith('.csv')) {
              fileList.push({
                name: item.name,
                uri: item.uri,
                size: item.size,
                type: item.name.endsWith('.json') ? 'json' : 'csv',
                isBackup: true,
              });
            }
          }
        }
      }

      setFiles(fileList);
    } catch (e) {
      console.warn('[ImportModal] Load files failed:', e);
    }
    setLoading(false);
  };

  const handleSelectFile = async (file) => {
    try {
      const f = new File(file.uri);
      const content = await f.text();
      setImportJson(content);
      setSelectedFile(file.name);
    } catch (e) {
      console.warn('[ImportModal] Read file failed:', e);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderFileItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.fileItem,
        { backgroundColor: tc.surface, borderColor: tc.border },
        selectedFile === item.name && { borderColor: tc.primary, backgroundColor: tc.primary + '10' },
      ]}
      onPress={() => handleSelectFile(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.fileIcon, { backgroundColor: item.type === 'json' ? '#6C63FF' + '15' : '#34C759' + '15' }]}>
        <Ionicons
          name={item.type === 'json' ? 'code-outline' : 'document-text-outline'}
          size={18}
          color={item.type === 'json' ? '#6C63FF' : '#34C759'}
        />
      </View>
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: tc.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.fileSize, { color: tc.textMuted }]}>
          {formatSize(item.size)}
          {item.isBackup ? ' · 自动备份' : ''}
        </Text>
      </View>
      {selectedFile === item.name && (
        <Ionicons name="checkmark-circle" size={20} color={tc.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>导入备份</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tc.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 文件列表 */}
          <Text style={[styles.inputLabel, { color: tc.textMuted, marginBottom: spacing.sm }]}>
            本地备份文件
          </Text>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={tc.primary} />
            </View>
          ) : files.length === 0 ? (
            <View style={[styles.emptyWrap, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
              <Ionicons name="folder-open-outline" size={24} color={tc.textSubtle} />
              <Text style={[styles.emptyText, { color: tc.textMuted }]}>暂无本地备份文件</Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.uri}
              renderItem={renderFileItem}
              style={[styles.fileList, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* 或粘贴文本 */}
          <Text style={[styles.inputLabel, { color: tc.textMuted, marginTop: spacing.md, marginBottom: spacing.sm }]}>
            或粘贴文本
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: tc.surfaceMuted,
                color: tc.text,
                height: 100,
                textAlignVertical: 'top',
                paddingTop: spacing.md,
                borderColor: tc.border,
              },
            ]}
            value={importJson}
            onChangeText={setImportJson}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="在此粘贴 JSON 或 CSV 内容"
            placeholderTextColor={tc.textSubtle}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary, flex: 1 }]}
              onPress={onImport}
              activeOpacity={0.85}
              disabled={!importJson.trim()}
            >
              <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>导入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default ImportModal;

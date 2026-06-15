// ImportModal: paste-or-pick backup data. The textarea state (importJson)
// and the actual import handler stay in the parent SettingsScreen; this
// modal is purely the form shell + propagation.
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, fontSize, spacing } from '../../theme';
import { styles } from './styles';

function ImportModal({ visible, onClose, importJson, setImportJson, onPickFile, onImport }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
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
          <Text style={{ color: tc.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, lineHeight: 20 }}>
            支持 JSON 完整备份 或 CSV 文本。自动识别格式，重复数据会被跳过。
          </Text>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: tc.surfaceMuted, marginBottom: spacing.md, height: 44 }]}
            onPress={onPickFile}
            activeOpacity={0.7}
          >
            <Ionicons name="document-attach-outline" size={18} color={tc.text} />
            <Text style={{ marginLeft: spacing.xs, color: tc.text, fontSize: fontSize.md }}>
              选择文件 (.json / .csv)
            </Text>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>或粘贴文本</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: tc.surfaceMuted,
                  color: tc.text,
                  height: 140,
                  textAlignVertical: 'top',
                  paddingTop: spacing.md,
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
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary, flex: 1 }]}
              onPress={onImport}
              activeOpacity={0.85}
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
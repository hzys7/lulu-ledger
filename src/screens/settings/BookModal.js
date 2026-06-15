// BookModal: create / edit a book. All form state and the save / delete
// handlers stay in the parent SettingsScreen; this modal is purely
// presentational + propagation.
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
import { hexAlpha, bookIcons, bookColors } from './_shared';
import { styles } from './styles';

function BookModal({ visible, onClose, editingBook, newBookName, setNewBookName,
  newBookIcon, setNewBookIcon, newBookColor, setNewBookColor, onSave, onDelete }) {
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
            <Text style={[styles.modalTitle, { color: tc.text }]}>
              {editingBook ? '编辑账本' : '新建账本'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tc.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: tc.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, lineHeight: 20 }}>
            支持 JSON 完整备份 或 CSV 文本。自动识别格式，重复数据会被跳过。
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>账本名称</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text }]}
              value={newBookName}
              onChangeText={setNewBookName}
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="off"
              placeholder="输入账本名称"
              placeholderTextColor={tc.textSubtle}
              maxLength={20}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>选择图标</Text>
            <View style={styles.iconGrid}>
              {bookIcons.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                    newBookIcon === icon && { borderColor: newBookColor, backgroundColor: hexAlpha(newBookColor, 0.08) },
                  ]}
                  onPress={() => setNewBookIcon(icon)}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={newBookIcon === icon ? newBookColor : tc.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>选择颜色</Text>
            <View style={styles.colorGrid}>
              {bookColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    newBookColor === color && { borderColor: tc.text, borderWidth: 3 },
                  ]}
                  onPress={() => setNewBookColor(color)}
                >
                  {newBookColor === color ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            {editingBook ? (
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: tc.dangerSubtle }]}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={18} color={tc.danger} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary }]}
              onPress={onSave}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default BookModal;
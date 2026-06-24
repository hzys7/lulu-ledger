// RecurringModal: add a recurring (template) transaction. Form state
// (recurringForm) lives in the parent; this is the form shell.
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, fontSize, spacing } from '../../theme';
import { styles } from './styles';

function RecurringModal({ visible, onClose, recurringForm, setRecurringForm, onSave }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const [showDatePicker, setShowDatePicker] = React.useState(false);

  const handleOpenDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setRecurringForm({ ...recurringForm, startDate: `${year}-${month}-${day}` });
    }
  };

  const handleClearDate = (e) => {
    e.stopPropagation();
    setRecurringForm({ ...recurringForm, startDate: '' });
  };

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
            <Text style={[styles.modalTitle, { color: tc.text }]}>新增周期交易</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={tc.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>类型</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {[{ key: 'expense', label: '支出' }, { key: 'income', label: '收入' }].map((t) => {
                const active = recurringForm.type === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.typePill,
                      { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                      active && { backgroundColor: tc.primary, borderColor: tc.primary },
                    ]}
                    onPress={() => setRecurringForm({ ...recurringForm, type: t.key })}
                  >
                    <Text style={[styles.typePillText, { color: tc.textSecondary }, active && { color: tc.primaryOn }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>分类</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text }]}
              value={recurringForm.category}
              onChangeText={(v) => setRecurringForm({ ...recurringForm, category: v })}
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="off"
              placeholder="如：工资 / 房租"
              placeholderTextColor={tc.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>金额</Text>
            <View style={[styles.amountRow, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
              <Text style={[styles.currency, { color: tc.textMuted }]}>
                {settings.currency === 'CNY' ? '¥' : '$'}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: tc.text }]}
                value={recurringForm.amount}
                onChangeText={(v) => setRecurringForm({ ...recurringForm, amount: v })}
                autoCorrect={false}
                autoCapitalize="none"
                autoComplete="off"
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tc.textSubtle}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>频率</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {[{ key: 'daily', label: '每天' }, { key: 'weekly', label: '每周' }, { key: 'monthly', label: '每月' }, { key: 'yearly', label: '每年' }].map((f) => {
                const active = recurringForm.frequency === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.typePill,
                      { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                      active && { backgroundColor: tc.primary, borderColor: tc.primary },
                    ]}
                    onPress={() => setRecurringForm({ ...recurringForm, frequency: f.key })}
                  >
                    <Text style={[styles.typePillText, { color: tc.textSecondary }, active && { color: tc.primaryOn }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>备注 (选填)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text }]}
              value={recurringForm.note}
              onChangeText={(v) => setRecurringForm({ ...recurringForm, note: v })}
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="off"
              placeholder="如：每月15号发工资"
              placeholderTextColor={tc.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>生效日期 (选填)</Text>
            <TouchableOpacity
              style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={handleOpenDatePicker}
            >
              <Text style={[styles.textInput, { color: recurringForm.startDate ? tc.text : tc.textSubtle, textAlign: 'left' }]}>{recurringForm.startDate || '选择日期'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {recurringForm.startDate && (
                  <TouchableOpacity onPress={handleClearDate} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                    <Ionicons name="close-circle" size={16} color={tc.textSubtle} />
                  </TouchableOpacity>
                )}
                <Ionicons name="calendar-outline" size={18} color={tc.textSubtle} />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: tc.primary, marginTop: spacing.sm, flex: 0, height: 48 }]}
            onPress={onSave}
            activeOpacity={0.85}
          >
            <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>保存</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 日期选择器放在 overlay 层，避免被 modal content 截断 */}
      {showDatePicker && (
        <DateTimePicker
          value={recurringForm.startDate ? new Date(recurringForm.startDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          textColor={tc.text}
          style={{ backgroundColor: tc.surface, borderRadius: 8, overflow: 'hidden' }}
        />
      )}
    </Modal>
  );
}

export default RecurringModal;
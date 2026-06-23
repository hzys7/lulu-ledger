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
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, fontSize, spacing } from '../../theme';
import { styles } from './styles';

function RecurringModal({ visible, onClose, recurringForm, setRecurringForm, onSave }) {
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
            <Text style={[styles.inputLabel, { color: tc.textMuted }]}>生效日期 (选填，默认下个月1号)</Text>
            <TouchableOpacity
              style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => {
                // 打开日期选择器
                const input = document.createElement('input');
                input.type = 'date';
                input.value = recurringForm.startDate || '';
                input.onchange = (e) => setRecurringForm({ ...recurringForm, startDate: e.target.value });
                input.click();
              }}
            >
              <Text style={[styles.textInput, { color: recurringForm.startDate ? tc.text : tc.textSubtle, textAlign: 'left' }]}>{recurringForm.startDate || '选择日期'}</Text>
              <Ionicons name="calendar-outline" size={18} color={tc.textSubtle} />
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
    </Modal>
  );
}

export default RecurringModal;
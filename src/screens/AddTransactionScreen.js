// 璐璐记账 · 记一笔
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFinance } from '../context/FinanceContext';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import {
  categories as categoryConfig,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
} from '../theme';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

function fmtDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

export default function AddTransactionScreen({ navigation, route }) {
  const { addTx, editTx, removeTx, settings, accounts } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const editTransaction = route.params?.transaction;
  const initialType = route.params?.type || 'expense';

  const [type, setType] = useState(editTransaction ? editTransaction.type : initialType);
  const [amount, setAmount] = useState(editTransaction ? String(editTransaction.amount) : '');
  const [category, setCategory] = useState(editTransaction ? editTransaction.category : '');
  const [note, setNote] = useState(editTransaction ? editTransaction.note : '');
  const [date, setDate] = useState(editTransaction ? editTransaction.date : new Date().toISOString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  // 账户选择：编辑时取原值，新增时取默认账户
  const defaultAccId = (accounts.find(a => a.isDefault) || accounts[0])?.id;
  const [accountId, setAccountId] = useState(
    editTransaction ? (editTransaction.accountId || defaultAccId) : defaultAccId
  );

  const categoryList = type === 'expense' ? categoryConfig.expense : categoryConfig.income;

  useEffect(() => {
    if (!editTransaction) setCategory('');
  }, [type]);

  const handleNumberInput = (key) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1].length >= 2) return;
    setAmount((p) => p + key);
  };
  const handleDelete = () => setAmount((p) => p.slice(0, -1));

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }
    if (!category) {
      Alert.alert('提示', '请选择分类');
      return;
    }
    const txData = { type, amount: numAmount, category, note, date, currency: settings.currency, accountId };
    if (editTransaction) {
      await editTx(editTransaction.id, txData);
      Alert.alert('已更新', '交易记录已修改', [{ text: '好的', onPress: () => navigation.goBack() }]);
    } else {
      await addTx(txData);
      setAmount('');
      setCategory('');
      setNote('');
      Alert.alert('记账成功', '已记录一笔', [
        { text: '继续记账' },
        { text: '返回首页', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleDeleteTransaction = () => {
    if (!editTransaction) return;
    Alert.alert('确认删除', '确定要删除这条记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await removeTx(editTransaction.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const displayAmount = amount || '0';
  const currencySymbol = getCurrencySymbol(settings.currency);
  const canSave = amount && parseFloat(amount) > 0 && category;

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <View style={styles.headerWrap}>
        <View style={[styles.segment, { backgroundColor: tc.surfaceMuted }]}>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'expense' && styles.segmentItemActive]}
            onPress={() => setType('expense')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                { color: type === 'expense' ? tc.text : tc.textMuted },
                type === 'expense' && styles.segmentTextActive,
              ]}
            >
              支出
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'income' && styles.segmentItemActive]}
            onPress={() => setType('income')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                { color: type === 'income' ? tc.text : tc.textMuted },
                type === 'income' && styles.segmentTextActive,
              ]}
            >
              收入
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.amountBlock}>
          <View style={styles.amountRow}>
            <Text style={[styles.currencySign, { color: tc.text }]}>{currencySymbol}</Text>
            <Text style={[styles.amountValue, { color: tc.text }]}>{displayAmount}</Text>
            <View style={[styles.cursor, { backgroundColor: tc.text }]} />
          </View>
          <Text style={[styles.amountHint, { color: tc.textMuted }]}>
            {amount ? (parseFloat(amount) > 0 ? '金额' : '输入金额') : '点击数字键输入金额'}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: tc.textMuted }]}>分类</Text>
            <Text style={[styles.sectionHint, { color: tc.textSubtle }]}>
              {category ? '已选 ' + category : '选择分类'}
            </Text>
          </View>
          <View style={styles.categoryGrid}>
            {categoryList.map((c, idx) => {
              const catColor = tc.categories[c.name] || tc.textMuted;
              const isActive = category === c.name;
              const isLastInRow = (idx + 1) % 4 === 0;
              return (
                <TouchableOpacity
                  key={c.name}
                  style={[
                    styles.categoryItem,
                    !isLastInRow && styles.categoryItemGap,
                    {
                      backgroundColor: isActive ? tc.surface : 'transparent',
                      borderColor: isActive ? tc.text : tc.border,
                      borderWidth: isActive ? 1.5 : StyleSheet.hairlineWidth,
                    },
                  ]}
                  onPress={() => setCategory(c.name)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: catColor + '22' },
                    ]}
                  >
                    <Ionicons name={c.icon} size={18} color={catColor} />
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      { color: isActive ? tc.text : tc.textSecondary },
                      isActive && { fontWeight: fontWeight.semibold },
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.metaRow}>
          <TouchableOpacity
            style={[styles.metaBtn, styles.metaBtnGap, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={tc.textMuted} />
            <Text style={[styles.metaText, { color: tc.text }]}>{fmtDay(date)}</Text>
          </TouchableOpacity>
          <View style={[styles.metaInputWrap, { backgroundColor: tc.surface, borderColor: tc.border }]}>
            <Ionicons name="create-outline" size={18} color={tc.textMuted} />
            <TextInput
              style={[styles.metaInput, { color: tc.text }]}
              placeholder="备注"
              placeholderTextColor={tc.textSubtle}
              value={note}
              onChangeText={setNote}
              maxLength={50}
                autoCorrect={false}
                autoCapitalize="none"
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
        </View>

        {/* 账户选择 */}
        <View style={styles.accountRow}>
          <Ionicons name="wallet-outline" size={16} color={tc.textMuted} style={styles.accountRowIcon} />
          <Text style={[styles.accountRowLabel, { color: tc.textMuted }]}>账户</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountChipsScroll}
          >
            {accounts.map((a) => {
              const active = a.id === accountId;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.accountChip,
                    {
                      backgroundColor: active ? tc.primary : tc.surfaceMuted,
                      borderColor: active ? tc.primary : tc.border,
                    },
                  ]}
                  onPress={() => setAccountId(a.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.accountChipText,
                      { color: active ? tc.primaryOn : tc.text },
                    ]}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={new Date(date)}
            mode="date"
            display={Platform.OS === 'web' ? 'default' : 'default'}
            onChange={(event, d) => {
              setShowDatePicker(Platform.OS === 'web');
              if (d) setDate(d.toISOString());
            }}
          />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: tc.surface,
            borderTopColor: tc.divider,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        <View style={styles.keypad}>
          {KEYS.map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((k, ki) => {
                const isDel = k === 'del';
                const isLast = ki === row.length - 1;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.keypadKey,
                      !isLast && styles.keypadKeyGap,
                      { backgroundColor: tc.surfaceMuted },
                    ]}
                    onPress={() => (isDel ? handleDelete() : handleNumberInput(k))}
                    activeOpacity={0.6}
                  >
                    {isDel ? (
                      <Ionicons name="backspace-outline" size={20} color={tc.text} />
                    ) : (
                      <Text style={[styles.keypadKeyText, { color: tc.text }]}>{k}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {editTransaction ? (
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: tc.surfaceMuted }]}
              onPress={handleDeleteTransaction}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={tc.danger} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: tc.primary,
                opacity: canSave ? 1 : 0.35,
              },
            ]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={20} color={tc.primaryOn} style={styles.saveBtnIcon} />
            <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>
              {editTransaction ? '保存修改' : '记一笔'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  segment: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },
  segmentTextActive: {
    fontWeight: fontWeight.semibold,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.base },

  amountBlock: { paddingTop: spacing.md, paddingBottom: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  currencySign: {
    fontSize: 28,
    fontWeight: fontWeight.medium,
    marginRight: spacing.sm,
    letterSpacing: -0.5,
    lineHeight: 48,
  },
  amountValue: {
    fontSize: 44,
    fontWeight: fontWeight.bold,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
    lineHeight: 48,
  },
  cursor: {
    width: 2,
    height: 32,
    marginLeft: 4,
    marginBottom: 8,
    opacity: 0.6,
  },
  amountHint: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
    marginTop: spacing.xs,
  },

  section: { marginTop: spacing.base },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryItem: {
    width: '24%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: borderRadius.md,
  },
  categoryItemGap: { marginRight: '1.3%' },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.base,
  },
  metaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  metaBtnGap: { marginRight: spacing.sm },
  metaText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
  metaInputWrap: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  metaInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    padding: 0,
    letterSpacing: -0.2,
  },

  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  keypad: {},
  keypadRow: { flexDirection: 'row', marginBottom: spacing.sm },
  keypadKey: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyGap: { marginRight: spacing.sm },
  keypadKeyText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  deleteBtn: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveBtnIcon: { marginRight: spacing.xs },
  saveBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  accountRowIcon: { marginRight: 4 },
  accountRowLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginRight: spacing.sm,
  },
  accountChipsScroll: { gap: 6, paddingRight: spacing.base },
  accountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 140,
  },
  accountChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },
});

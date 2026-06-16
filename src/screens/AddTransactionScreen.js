// 小璐记账 · 记一笔（重构：分类页 + 底部抽屉）
// 流程：点 tab 栏记一笔 -> 分类页 -> 点分类 -> 弹底部抽屉填金额保存
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFinance } from '../context/FinanceContext';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import { saveCorrection } from '../utils/aiCorrections';
import { suggestCategories } from '../utils/aiCategorySuggest';
import { MOOD_OPTIONS } from '../utils/aiMoodShared';
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

// 抽屉顶部条带：分类图标 + 名称 + 关闭
function FormHeader({ category, type, onClose, tc, catColor, catIcon }) {
  return (
    <View style={styles.formHeader}>
      <View style={[styles.formHeaderCat, { backgroundColor: catColor + '22' }]}>
        <Ionicons name={catIcon} size={20} color={catColor} />
      </View>
      <View style={styles.formHeaderText}>
        <Text style={[styles.formHeaderType, { color: tc.textMuted }]}>
          {type === 'expense' ? '支出' : '收入'}
        </Text>
        <Text style={[styles.formHeaderName, { color: tc.text }]}>{category}</Text>
      </View>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.formHeaderClose}
      >
        <Ionicons name="close" size={22} color={tc.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

export default function AddTransactionScreen({ navigation, route }) {
  const { addTx, editTx, removeTx, settings, accounts } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const editTransaction = route.params?.transaction;
  const initialType = route.params?.type || 'expense';

  // 分类页状态
  const [type, setType] = useState(editTransaction ? editTransaction.type : initialType);

  // 抽屉状态
  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const defaultAccId = (accounts.find(a => a.isDefault) || accounts[0])?.id;
  const [accountId, setAccountId] = useState(defaultAccId);
  const [mood, setMood] = useState('');

  // 智能分类建议
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  useEffect(() => {
    if (!note || note.trim().length < 2) {
      setCategorySuggestions([]);
      return;
    }
    const suggestions = suggestCategories(note, type);
    setCategorySuggestions(suggestions.filter(s => s.category !== formCategory));
  }, [note, type, formCategory]);

  // 使用 ref 缓存金额，减少 re-render
  const amountRef = useRef('');
  const [displayAmount, setDisplayAmount] = useState('0');

  // 打开抽屉：新建（从分类页来）
  function openFormForCategory(catName) {
    setFormCategory(catName);
    amountRef.current = '';
    setDisplayAmount('0');
    setNote('');
    setDate(new Date().toISOString());
    setAccountId(defaultAccId);
    setMood('');
    setFormOpen(true);
  }

  // 打开抽屉：编辑
  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setFormCategory(editTransaction.category);
      amountRef.current = String(editTransaction.amount);
      setDisplayAmount(amountRef.current || '0');
      setNote(editTransaction.note || '');
      setDate(editTransaction.date);
      setAccountId(editTransaction.accountId || defaultAccId);
      setMood(editTransaction.mood || '');
      setFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeForm() {
    setFormOpen(false);
    if (editTransaction) {
      navigation.goBack();
    }
  }

  // 数字键盘 - 使用 ref 减少 re-render
  const handleNumberInput = useCallback((key) => {
    let val = amountRef.current;
    if (key === '.' && val.includes('.')) return;
    if (val.includes('.') && val.split('.')[1].length >= 2) return;
    val += key;
    amountRef.current = val;
    setDisplayAmount(val);
  }, []);

  const handleDelete = useCallback(() => {
    const val = amountRef.current.slice(0, -1);
    amountRef.current = val;
    setDisplayAmount(val || '0');
  }, []);

  const handleSave = async () => {
    const numAmount = parseFloat(amountRef.current);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }
    if (!formCategory) {
      Alert.alert('提示', '请选择分类');
      return;
    }
    const txData = {
      type, amount: numAmount, category: formCategory, note, date,
      currency: settings.currency, accountId, mood,
    };
    if (editTransaction) {
      // 如果用户修改了分类，保存纠正记录（用于 AI 学习）
      if (editTransaction.category && editTransaction.category !== formCategory) {
        saveCorrection({
          originalCategory: editTransaction.category,
          correctedCategory: formCategory,
          note: editTransaction.note || '',
          type: editTransaction.type || type,
        }).catch(() => {});
      }
      await editTx(editTransaction.id, txData);
      Alert.alert('已更新', '交易记录已修改', [{ text: '好的', onPress: () => navigation.goBack() }]);
    } else {
      await addTx(txData);
      // 连续记账：清空金额，留在分类页
      amountRef.current = '';
      setDisplayAmount('0');
      setNote('');
      setFormOpen(false);
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

  const currencySymbol = getCurrencySymbol(settings.currency);
  const canSave = amountRef.current && parseFloat(amountRef.current) > 0;
  const categoryList = type === 'expense' ? categoryConfig.expense : categoryConfig.income;
  const currentCat = categoryList.find(c => c.name === formCategory);
  const catColor = currentCat ? (tc.categories[formCategory] || tc.textMuted) : tc.textMuted;
  const catIcon = currentCat?.icon || 'help';

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      {/* ============ 分类页 ============ */}
      <View style={styles.pageWrap}>
        <View style={[styles.segment, { backgroundColor: tc.surfaceMuted }]}>
          <TouchableOpacity
            style={[styles.segmentItem, type === 'expense' && [styles.segmentItemActive, { backgroundColor: tc.surface }]]}
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
            style={[styles.segmentItem, type === 'income' && [styles.segmentItemActive, { backgroundColor: tc.surface }]]}
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

        <ScrollView
          style={styles.pageScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pageScrollContent}
        >
          <View style={styles.categoryGrid}>
            {categoryList.map((c) => {
              const color = tc.categories[c.name] || tc.textMuted;
              return (
                <TouchableOpacity
                  key={c.name}
                  style={styles.categoryItem}
                  onPress={() => openFormForCategory(c.name)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: color + '22' }]}>
                    <Ionicons name={c.icon} size={22} color={color} />
                  </View>
                  <Text style={[styles.categoryName, { color: tc.text }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ============ 底部抽屉 ============ */}
      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={closeForm}
        statusBarTranslucent
      >
        <View style={styles.drawerBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeForm} />
          <View
            style={[
              styles.drawer,
              {
                backgroundColor: tc.surface,
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
          >
            {/* 顶部条带 */}
            <View style={[styles.handle, { backgroundColor: tc.divider }]} />
            <FormHeader
              category={formCategory}
              type={type}
              onClose={closeForm}
              tc={tc}
              catColor={catColor}
              catIcon={catIcon}
            />

            {/* 金额显示 */}
            <View style={styles.amountBlock}>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySign, { color: tc.text }]}>{currencySymbol}</Text>
                <Text style={[styles.amountValue, { color: tc.text }]}>{displayAmount}</Text>
              </View>
            </View>

            {/* 消费心情 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodScroll}
            >
              {MOOD_OPTIONS.map((m) => {
                const active = mood === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      styles.moodChip,
                      {
                        backgroundColor: active ? tc.primary : tc.surfaceMuted,
                        borderColor: active ? tc.primary : tc.border,
                      },
                    ]}
                    onPress={() => setMood(mood === m.key ? '' : m.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text
                      style={[
                        styles.moodLabel,
                        { color: active ? tc.primaryOn : tc.text },
                      ]}
                      numberOfLines={1}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 数字键盘 */}
            <View style={styles.keypad}>
              {KEYS.map((row, ri) => (
                <View key={ri} style={styles.keypadRow}>
                  {row.map((k, ki) => {
                    const isDel = k === 'del';
                    const isLast = ki === row.length - 1;
                    return (
                      <View
                        key={k}
                        style={[
                          styles.keypadKey,
                          !isLast && styles.keypadKeyGap,
                          { backgroundColor: tc.surfaceMuted },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.keypadKeyInner}
                          onPress={() => (isDel ? handleDelete() : handleNumberInput(k))}
                          activeOpacity={0.6}
                        >
                          {isDel ? (
                            <Ionicons name="backspace-outline" size={20} color={tc.text} />
                          ) : (
                            <Text style={[styles.keypadKeyText, { color: tc.text }]}>{k}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* 日期 + 备注 + 账户 */}
            <View style={styles.metaRow}>
              <TouchableOpacity
                style={[styles.metaBtn, { backgroundColor: tc.surfaceMuted }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={16} color={tc.textMuted} />
                <Text style={[styles.metaText, { color: tc.text }]}>{fmtDay(date)}</Text>
              </TouchableOpacity>
              <View style={[styles.metaInputWrap, { backgroundColor: tc.surfaceMuted }]}>
                <Ionicons name="create-outline" size={16} color={tc.textMuted} />
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

            {/* 智能分类建议 */}
            {categorySuggestions.length > 0 && (
              <View style={styles.suggestionRow}>
                <Ionicons name="sparkles" size={12} color={tc.accent} />
                <Text style={[styles.suggestionLabel, { color: tc.textMuted }]}>推荐：</Text>
                {categorySuggestions.map((s) => (
                  <TouchableOpacity
                    key={s.category}
                    style={[styles.suggestionChip, { backgroundColor: tc.accentSubtle }]}
                    onPress={() => setFormCategory(s.category)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestionText, { color: tc.accent }]}>{s.category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

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

            {/* 操作按钮 */}
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ========== 分类页 ==========
  pageWrap: { flex: 1, paddingHorizontal: spacing.base, paddingTop: spacing.sm },
  segment: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    padding: 3,
    marginBottom: spacing.md,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
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
  pageScroll: { flex: 1 },
  pageScrollContent: { paddingBottom: spacing.xl },

  // 分类网格（4 列）
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  // ========== 抽屉 ==========
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  drawer: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  formHeaderCat: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  formHeaderText: { flex: 1 },
  formHeaderType: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  formHeaderName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  formHeaderClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 金额
  amountBlock: { paddingVertical: spacing.sm },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  currencySign: {
    fontSize: fontSize.xxl,
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

  // 消费心情
  moodScroll: { gap: 4, paddingBottom: spacing.sm, paddingRight: spacing.base },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  moodEmoji: { fontSize: fontSize.sm },
  moodLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, letterSpacing: -0.1 },

  // 数字键盘
  keypad: {},
  keypadRow: { flexDirection: 'row', marginBottom: spacing.sm },
  keypadKey: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  keypadKeyGap: { marginRight: spacing.sm },
  keypadKeyText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },

  // 日期 + 备注
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  metaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  metaText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
  metaInputWrap: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  metaInput: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    padding: 0,
    letterSpacing: -0.2,
  },

  // 账户 chip
  accountChipsScroll: { gap: 6, paddingRight: spacing.base, paddingBottom: spacing.sm },
  accountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 140,
  },
  accountChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  // 智能分类建议
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  suggestionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  suggestionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  suggestionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // 操作按钮
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
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
});
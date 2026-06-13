// 璐璐记账 · 预算
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { EmptyState } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import {
  categories as categoryConfig,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
} from '../theme';

function hexAlpha(hex, a) {
  if (!hex) return hex;
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

export default function BudgetScreen() {
  const { budgets, transactions, settings, updateBudget, removeBudget, checkBudgetAlerts } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const selectedYear = new Date().getFullYear();
  const [budgetAlerts, setBudgetAlerts] = useState([]);

  const currentMonth = selectedYear + '-' + String(selectedMonth + 1).padStart(2, '0');

  useEffect(() => {
    setBudgetAlerts(checkBudgetAlerts());
  }, [transactions, budgets]);

  const monthExpenseByCategory = useMemo(() => {
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && t.type === 'expense';
    });
    const byCategory = {};
    monthTx.forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return byCategory;
  }, [transactions, selectedYear, selectedMonth]);

  const budgetItems = useMemo(() => {
    return budgets
      .filter((b) => b.month === currentMonth && b.category !== '__total__')
      .map((b) => {
        const spent = monthExpenseByCategory[b.category] || 0;
        const percent = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
        const remaining = b.amount - spent;
        return {
          ...b,
          spent,
          percent,
          remaining,
          isOver: remaining < 0,
          isWarning: percent >= 80 && percent < 100,
        };
      });
  }, [budgets, monthExpenseByCategory, currentMonth]);

  const totalBudgetItem = budgets.find((b) => b.category === '__total__' && b.month === currentMonth);
  const totalBudgetAmount = totalBudgetItem
    ? totalBudgetItem.amount
    : budgetItems.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetItems.reduce((sum, b) => sum + b.spent, 0);
  const totalPercent = totalBudgetAmount > 0 ? Math.min((totalSpent / totalBudgetAmount) * 100, 100) : 0;
  const totalIsOver = totalSpent > totalBudgetAmount;

  const openAddModal = (categoryName = '') => {
    if (categoryName === '__total__') {
      setEditingCategory('__total__');
      setBudgetAmount(totalBudgetItem ? String(totalBudgetItem.amount) : '');
      setShowModal(true);
      return;
    }
    const existing = budgetItems.find((b) => b.category === categoryName);
    setEditingCategory(categoryName);
    setBudgetAmount(existing ? String(existing.amount) : '');
    setShowModal(true);
  };

  const handleSaveBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (!amount || amount <= 0) {
      Alert.alert('提示', '请输入有效的预算金额');
      return;
    }
    if (!editingCategory) {
      Alert.alert('提示', '请选择分类');
      return;
    }
    await updateBudget({ category: editingCategory, amount, month: currentMonth });
    setShowModal(false);
  };

  const handleDeleteBudget = (category) => {
    const label = category === '__total__' ? '总预算' : '';
    Alert.alert('删除预算', '确定删除' + label + '的预算设置吗?', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeBudget(category, currentMonth) },
    ]);
  };

  const statusColor = (item) => {
    if (item.isOver) return tc.danger;
    if (item.isWarning) return tc.warning;
    return tc.text;
  };
  const statusIcon = (item) => {
    if (item.isOver) return 'alert-circle';
    if (item.isWarning) return 'alert-circle-outline';
    return 'checkmark-circle-outline';
  };

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.brand, { color: tc.textMuted }]}>规划</Text>
          <Text style={[styles.title, { color: tc.text }]}>预算</Text>
        </View>

        <View style={styles.monthBar}>
          <TouchableOpacity
            onPress={() => setSelectedMonth(Math.max(0, selectedMonth - 1))}
            disabled={selectedMonth === 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={selectedMonth === 0 ? tc.textSubtle : tc.text} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: tc.text }]}>
            {selectedYear} 年 {selectedMonth + 1} 月
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedMonth(Math.min(11, selectedMonth + 1))}
            disabled={selectedMonth === 11}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={20} color={selectedMonth === 11 ? tc.textSubtle : tc.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.totalWrap}>
          <View style={[styles.totalCard, { backgroundColor: tc.surface, borderColor: tc.border, borderWidth: StyleSheet.hairlineWidth, ...shadows.sm }]}>
            <View style={styles.totalTopRow}>
              <View>
                <Text style={[styles.totalLabel, { color: tc.textMuted }]}>本月总预算</Text>
                <Text style={[styles.totalAmount, { color: tc.text }]}>
                  {formatMoney(totalBudgetAmount, settings.currency)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: tc.surfaceMuted }]}
                onPress={() => openAddModal('__total__')}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color={tc.text} />
                <Text style={[styles.iconBtnText, { color: tc.text }]}>
                  {totalBudgetItem ? '修改' : '设置'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.totalMetaRow}>
              <Text style={[styles.totalMeta, { color: tc.textMuted }]}>
                已用 {formatMoney(totalSpent, settings.currency)}
              </Text>
              <Text style={[styles.totalMeta, { color: tc.textMuted }]}>
                剩余 {formatMoney(Math.max(totalBudgetAmount - totalSpent, 0), settings.currency)}
              </Text>
            </View>
            <View style={[styles.progress, { backgroundColor: tc.surfaceMuted }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: totalPercent + '%',
                    backgroundColor: totalIsOver ? tc.danger : tc.text,
                  },
                ]}
              />
            </View>
            <Text style={[styles.percentText, { color: tc.textSecondary }]}>
              {totalPercent.toFixed(0)}%
            </Text>
          </View>
        </View>

        {budgetAlerts.length > 0 ? (
          <View style={styles.alertsWrap}>
            {budgetAlerts.map((alert, index) => (
              <View key={index} style={[styles.alertItem, { backgroundColor: tc.dangerSubtle }]}>
                <Ionicons name="warning-outline" size={16} color={tc.danger} />
                <Text style={[styles.alertText, { color: tc.danger }]} numberOfLines={1}>
                  {alert.category} 已超支 {formatMoney(alert.over, settings.currency)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.addBtn, { borderColor: tc.border, backgroundColor: tc.surface }]}
          onPress={() => openAddModal()}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={tc.text} />
          <Text style={[styles.addBtnText, { color: tc.text }]}>添加分类预算</Text>
        </TouchableOpacity>

        {budgetItems.length > 0 ? (
          <View style={styles.listWrap}>
            {budgetItems.map((item) => {
              const tint = statusColor(item);
              const cat = categoryConfig.expense.find((c) => c.name === item.category);
              const catColor = tc.categories[item.category] || tc.primary;
              return (
                <TouchableOpacity
                  key={item.category}
                  style={[styles.budgetCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
                  onLongPress={() => handleDeleteBudget(item.category)}
                  activeOpacity={0.7}
                >
                  <View style={styles.budgetTopRow}>
                    <View style={styles.budgetLeft}>
                      <View style={[styles.budgetIcon, { backgroundColor: hexAlpha(catColor, 0.12) }]}>
                        <Ionicons name={cat?.icon || 'pricetag'} size={18} color={catColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.budgetName, { color: tc.text }]} numberOfLines={1}>
                          {item.category}
                        </Text>
                        <Text style={[styles.budgetDetail, { color: tc.textMuted }]}>
                          {formatMoney(item.spent, settings.currency)} / {formatMoney(item.amount, settings.currency)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.budgetRight}>
                      <Ionicons name={statusIcon(item)} size={18} color={tint} />
                      <Text style={[styles.budgetPercent, { color: tint }]}>
                        {item.percent.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.progress, { backgroundColor: tc.surfaceMuted }]}>
                    <View
                      style={[styles.progressFill, { width: item.percent + '%', backgroundColor: tint }]}
                    />
                  </View>
                  {item.remaining < 0 ? (
                    <Text style={[styles.overText, { color: tc.danger }]}>
                      已超支 {formatMoney(Math.abs(item.remaining), settings.currency)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="wallet-outline"
              title="暂无预算"
              subtitle="点击上方按钮设置本月分类预算"
            />
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>
                {editingCategory === '__total__'
                  ? totalBudgetItem
                    ? '修改总预算'
                    : '设置总预算'
                  : editingCategory
                  ? `设置「${editingCategory}」预算`
                  : '添加分类预算'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tc.textMuted} />
              </TouchableOpacity>
            </View>

            {editingCategory !== '__total__' && !editingCategory ? (
              <View style={styles.categorySelect}>
                <Text style={[styles.modalLabel, { color: tc.textMuted }]}>选择分类</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chips}>
                    {categoryConfig.expense.map((cat) => {
                      const tint = tc.categories[cat.name] || tc.primary;
                      const active = editingCategory === cat.name;
                      return (
                        <TouchableOpacity
                          key={cat.name}
                          style={[
                            styles.chip,
                            { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                            active && { backgroundColor: tint, borderColor: tint },
                          ]}
                          onPress={() => setEditingCategory(cat.name)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: tc.textSecondary },
                              active && { color: tc.primaryOn, fontWeight: fontWeight.semibold },
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.amountSection}>
              <Text style={[styles.modalLabel, { color: tc.textMuted }]}>预算金额</Text>
              <View style={[styles.amountRow, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <Text style={[styles.currency, { color: tc.textMuted }]}>
                  {settings.currency === 'CNY' ? '¥' : '$'}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: tc.text }]}
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={tc.textSubtle}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary, opacity: budgetAmount ? 1 : 0.4 }]}
              onPress={handleSaveBudget}
              disabled={!budgetAmount}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>保存</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },

  headerRow: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  brand: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.6, marginTop: 2 },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  monthText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, minWidth: 110, textAlign: 'center', letterSpacing: -0.2 },

  totalWrap: { paddingHorizontal: spacing.base, marginBottom: spacing.base },
  totalCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  totalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  totalLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  totalAmount: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  iconBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: -0.1 },
  totalMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  totalMeta: { fontSize: fontSize.sm, fontVariant: ['tabular-nums'], letterSpacing: -0.1 },
  percentText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'right',
    marginTop: spacing.xs,
    letterSpacing: -0.1,
  },

  progress: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: '100%', borderRadius: 3 },

  alertsWrap: { paddingHorizontal: spacing.base, marginBottom: spacing.base },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  alertText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, flex: 1, letterSpacing: -0.2 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  addBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },

  listWrap: { paddingHorizontal: spacing.base },
  budgetCard: {
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  budgetTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  budgetIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  budgetName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  budgetDetail: { fontSize: fontSize.sm, marginTop: 2, fontVariant: ['tabular-nums'], letterSpacing: -0.1 },
  budgetRight: { alignItems: 'flex-end', gap: 2 },
  budgetPercent: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'], letterSpacing: -0.1 },
  overText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: spacing.sm, letterSpacing: -0.1 },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D4D8',
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  modalLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.sm, letterSpacing: -0.1 },
  categorySelect: { marginBottom: spacing.base },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.base },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1 },
  chipText: { fontSize: fontSize.sm, letterSpacing: -0.1 },
  amountSection: { marginBottom: spacing.base },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  currency: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginRight: spacing.sm, letterSpacing: -0.3 },
  amountInput: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    paddingVertical: spacing.md,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  saveBtn: {
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
});

// 小璐记账 · 预算
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

export default function BudgetScreen({ route }) {
  const { budgets, transactions, settings, updateBudget, removeBudget, checkBudgetAlerts } = useFinance();

  // 路由参数：可选 month（格式 'YYYY-MM'），传入时初始化当前选中月
  // RecordsScreen 的预算模块会传对应筛选月份过来
  const initialMonth = (() => {
    const m = route?.params?.month;
    if (typeof m !== 'string') return null;
    const match = m.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const y = parseInt(match[1], 10);
    const mo = parseInt(match[2], 10) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 0 || mo > 11) return null;
    return { year: y, month: mo };
  })();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ? initialMonth.month : new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(initialMonth ? initialMonth.year : new Date().getFullYear());
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
        const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
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
  const totalPercent = totalBudgetAmount > 0 ? (totalSpent / totalBudgetAmount) * 100 : 0;
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

    // 如果设置了总预算，校验分类预算总和不超过总预算
    if (editingCategory !== '__total__' && totalBudgetItem) {
      // 计算当前所有分类预算之和（排除正在编辑的分类的旧值）
      const otherSum = budgetItems
        .filter(b => b.category !== editingCategory)
        .reduce((sum, b) => sum + b.amount, 0);
      if (otherSum + amount > totalBudgetAmount) {
        Alert.alert(
          '超出总预算',
          `分类预算总和 (${formatMoney(otherSum + amount, settings.currency)}) 超过了总预算 (${formatMoney(totalBudgetAmount, settings.currency)})，请调整金额`
        );
        return;
      }
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
        <View style={[styles.headerRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }]}>
          <Text style={[styles.title, { color: tc.text }]}>预算</Text>
        </View>

        <View style={styles.monthBar}>
          <TouchableOpacity
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedYear(selectedYear - 1);
                setSelectedMonth(11);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={tc.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedYear(selectedYear - 1);
                setSelectedMonth(11);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.yearNav}
          >
            <Text style={[styles.monthText, { color: tc.text }]}>
              {selectedYear} 年 {selectedMonth + 1} 月
            </Text>
            <Ionicons name="chevron-down" size={14} color={tc.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (selectedMonth === 11) {
                setSelectedYear(selectedYear + 1);
                setSelectedMonth(0);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={20} color={tc.text} />
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
              <View style={{ flexDirection: 'row', height: '100%' }}>
                <View style={{
                  width: `${Math.min(totalPercent, 100)}%`,
                  backgroundColor: totalIsOver ? tc.danger : tc.text,
                  height: '100%',
                  borderTopLeftRadius: 3,
                  borderBottomLeftRadius: 3,
                  borderTopRightRadius: totalIsOver ? 0 : 3,
                  borderBottomRightRadius: totalIsOver ? 0 : 3,
                }} />
                {totalIsOver && (
                  <View style={{
                    width: `${Math.min(totalPercent - 100, 100)}%`,
                    backgroundColor: tc.danger,
                    height: '100%',
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  }} />
                )}
              </View>
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
                  onPress={() => openAddModal(item.category)}
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
                    <View style={{ flexDirection: 'row', height: '100%' }}>
                      <View style={{
                        width: `${Math.min(item.percent, 100)}%`,
                        backgroundColor: tint,
                        height: '100%',
                        borderTopLeftRadius: 3,
                        borderBottomLeftRadius: 3,
                        borderTopRightRadius: item.isOver ? 0 : 3,
                        borderBottomRightRadius: item.isOver ? 0 : 3,
                      }} />
                      {item.isOver && (
                        <View style={{
                          width: `${Math.min(item.percent - 100, 100)}%`,
                          backgroundColor: tc.danger,
                          height: '100%',
                          borderTopRightRadius: 3,
                          borderBottomRightRadius: 3,
                        }} />
                      )}
                    </View>
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
            <View style={[styles.handle, { backgroundColor: tc.divider }]} />
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
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.categoryGrid}>
                    {categoryConfig.expense.map((cat) => {
                      const color = tc.categories[cat.name] || tc.primary;
                      const active = editingCategory === cat.name;
                      return (
                        <TouchableOpacity
                          key={cat.name}
                          style={styles.gridItem}
                          onPress={() => setEditingCategory(cat.name)}
                          activeOpacity={0.6}
                        >
                          <View style={[styles.gridIcon, {
                            backgroundColor: active ? color : color + '22',
                            borderWidth: active ? 2 : 0,
                            borderColor: active ? color : 'transparent',
                          }]}>
                            <Ionicons name={cat.icon} size={20} color={active ? '#fff' : color} />
                          </View>
                          <Text style={[styles.gridName, {
                            color: active ? color : tc.text,
                            fontWeight: active ? fontWeight.semibold : fontWeight.medium,
                          }]} numberOfLines={1}>
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
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.6, marginTop: 2 },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  monthText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center', letterSpacing: -0.2 },
  yearNav: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 110, justifyContent: 'center' },

  totalWrap: { paddingHorizontal: spacing.base, marginBottom: spacing.base },
  totalCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
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

  progress: { height: 6, borderRadius: 3, marginTop: spacing.sm },

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
    ...shadows.md,
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
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gridName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
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

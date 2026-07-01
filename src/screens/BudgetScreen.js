// 小璐记账 · 预算
// v1.6.12 紫色风格美化
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

function DecoStar({ style, size = 12, color = '#C4B5FD' }) {
  return (
    <Ionicons name="star" size={size} color={color} style={style} />
  );
}

export default function BudgetScreen({ route }) {
  const { budgets, transactions, settings, updateBudget, removeBudget, checkBudgetAlerts } = useFinance();

  // 路由参数：可选 month（格式 'YYYY-MM'），传入时初始化当前选中月
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
    <View style={[styles.container, { backgroundColor: tc.pageBg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ─── 头部 ──────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: tc.text }]}>预算</Text>
            <Text style={[styles.subtitle, { color: tc.textMuted }]}>管理每月开支计划</Text>
          </View>
          <DecoStar style={styles.starTopRight} size={12} color={tc.starColor} />
        </View>

        {/* ─── 月份导航 ──────────────────────────── */}
        <View style={[styles.monthBar, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <TouchableOpacity
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedYear(selectedYear - 1);
                setSelectedMonth(11);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.monthArrow, { backgroundColor: tc.surfaceMuted }]}
          >
            <Ionicons name="chevron-back" size={18} color={tc.text} />
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
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.monthLabel}
          >
            <Text style={[styles.monthText, { color: tc.text }]}>
              {selectedYear} 年 {selectedMonth + 1} 月
            </Text>
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
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.monthArrow, { backgroundColor: tc.surfaceMuted }]}
          >
            <Ionicons name="chevron-forward" size={18} color={tc.text} />
          </TouchableOpacity>
        </View>

        {/* ─── 总预算卡片 ────────────────────────── */}
        <View style={styles.totalWrap}>
          <View style={[styles.totalCard, { backgroundColor: tc.card, borderColor: tc.border, ...shadows.md }]}>
            <DecoStar style={styles.starTotal1} size={10} color={tc.starColorLight} />
            <DecoStar style={styles.starTotal2} size={8} color={tc.starColor} />
            <View style={styles.totalTopRow}>
              <View>
                <Text style={[styles.totalLabel, { color: tc.primary }]}>
                  <Ionicons name="wallet-outline" size={13} color={tc.primary} /> 本月总预算
                </Text>
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
                  backgroundColor: totalIsOver ? tc.danger : tc.primary,
                  height: '100%',
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                  borderTopRightRadius: totalIsOver ? 0 : 4,
                  borderBottomRightRadius: totalIsOver ? 0 : 4,
                }} />
                {totalIsOver && (
                  <View style={{
                    width: `${Math.min(totalPercent - 100, 100)}%`,
                    backgroundColor: tc.danger,
                    height: '100%',
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  }} />
                )}
              </View>
            </View>
            <View style={styles.totalPercentRow}>
              <Text style={[styles.percentText, { color: totalIsOver ? tc.danger : tc.textSecondary }]}>
                {totalPercent.toFixed(0)}%
              </Text>
              <Text style={[styles.percentLabel, { color: tc.textSubtle }]}>
                {totalIsOver ? '已超支' : '已使用'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 超支提醒 ──────────────────────────── */}
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

        {/* ─── 添加分类预算按钮 ──────────────────── */}
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: tc.border, backgroundColor: tc.card }]}
          onPress={() => openAddModal()}
          activeOpacity={0.7}
        >
          <View style={[styles.addBtnIcon, { backgroundColor: tc.primary + '18' }]}>
            <Ionicons name="add" size={18} color={tc.primary} />
          </View>
          <Text style={[styles.addBtnText, { color: tc.text }]}>添加分类预算</Text>
        </TouchableOpacity>

        {/* ─── 分类预算列表 ──────────────────────── */}
        {budgetItems.length > 0 ? (
          <View style={styles.listWrap}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>分类预算</Text>
            {budgetItems.map((item) => {
              const tint = statusColor(item);
              const cat = categoryConfig.expense.find((c) => c.name === item.category);
              const catColor = tc.categories[item.category] || tc.primary;
              return (
                <TouchableOpacity
                  key={item.category}
                  style={[styles.budgetCard, { backgroundColor: tc.card, borderColor: tc.border, ...shadows.sm }]}
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
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                        borderTopRightRadius: item.isOver ? 0 : 4,
                        borderBottomRightRadius: item.isOver ? 0 : 4,
                      }} />
                      {item.isOver && (
                        <View style={{
                          width: `${Math.min(item.percent - 100, 100)}%`,
                          backgroundColor: tc.danger,
                          height: '100%',
                          borderTopRightRadius: 4,
                          borderBottomRightRadius: 4,
                        }} />
                      )}
                    </View>
                  </View>
                  {item.remaining < 0 ? (
                    <Text style={[styles.overText, { color: tc.danger }]}>
                      <Ionicons name="alert-circle" size={12} color={tc.danger} /> 已超支 {formatMoney(Math.abs(item.remaining), settings.currency)}
                    </Text>
                  ) : item.isWarning ? (
                    <Text style={[styles.warningText, { color: tc.warning }]}>
                      <Ionicons name="alert-circle-outline" size={12} color={tc.warning} /> 即将超支，剩余 {formatMoney(item.remaining, settings.currency)}
                    </Text>
                  ) : (
                    <Text style={[styles.remainText, { color: tc.textSubtle }]}>
                      剩余 {formatMoney(item.remaining, settings.currency)}
                    </Text>
                  )}
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

      {/* ─── 弹窗 ──────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.modalHandle, { backgroundColor: tc.divider }]} />
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

  // ── 头部 ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xxs,
    letterSpacing: -0.1,
  },
  starTopRight: {
    position: 'absolute',
    top: 4,
    right: spacing.base,
  },

  // ── 月份导航 ──
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  monthArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  monthText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },

  // ── 总预算卡片 ──
  totalWrap: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  totalCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  starTotal1: {
    position: 'absolute',
    top: 16,
    right: 80,
  },
  starTotal2: {
    position: 'absolute',
    top: 50,
    right: 40,
  },
  totalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  totalLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },
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
  iconBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },
  totalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  totalMeta: {
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  totalPercentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  percentText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },
  percentLabel: {
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
  },

  // ── 进度条 ──
  progress: {
    height: 8,
    borderRadius: 4,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },

  // ── 超支提醒 ──
  alertsWrap: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  alertText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    flex: 1,
    letterSpacing: -0.2,
  },

  // ── 添加按钮 ──
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  addBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },

  // ── 分类预算列表 ──
  listWrap: {
    paddingHorizontal: spacing.base,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
    marginBottom: spacing.md,
  },
  budgetCard: {
    padding: spacing.base,
    borderRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  budgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  budgetIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  budgetDetail: {
    fontSize: fontSize.sm,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  budgetRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  budgetPercent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  overText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
    letterSpacing: -0.1,
  },
  warningText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
    letterSpacing: -0.1,
  },
  remainText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing.sm,
    letterSpacing: -0.1,
  },

  emptyWrap: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
  },

  // ── 弹窗 ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalHandle: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  modalLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
    letterSpacing: -0.1,
  },
  categorySelect: {
    marginBottom: spacing.base,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
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
  amountSection: {
    marginBottom: spacing.base,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  currency: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    marginRight: spacing.sm,
    letterSpacing: -0.3,
  },
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
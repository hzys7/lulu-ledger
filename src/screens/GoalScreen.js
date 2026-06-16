// 璐璐记账 · 消费目标管理
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney } from '../utils/currency';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors } from '../theme';
import {
  getGoals,
  addGoal,
  removeGoal,
  getGoalProgress,
  generateGoalAdvice,
} from '../utils/aiGoalTracker';
import { categories as categoryConfig } from '../theme';

export default function GoalScreen() {
  const { settings, transactions } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [goals, setGoals] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalAmount, setNewGoalAmount] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('');
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [goalAdvice, setGoalAdvice] = useState({});

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const loaded = await getGoals();
    setGoals(loaded);
  };

  const handleAddGoal = async () => {
    if (!newGoalName.trim()) {
      Alert.alert('提示', '请输入目标名称');
      return;
    }
    const amount = parseFloat(newGoalAmount);
    if (!amount || amount <= 0) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }
    await addGoal({
      name: newGoalName.trim(),
      category: newGoalCategory || null,
      amount,
      period: 'month',
    });
    setShowAddModal(false);
    setNewGoalName('');
    setNewGoalAmount('');
    setNewGoalCategory('');
    loadGoals();
  };

  const handleDeleteGoal = (goal) => {
    Alert.alert('删除目标', `确定删除「${goal.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await removeGoal(goal.id);
          loadGoals();
        },
      },
    ]);
  };

  const handleGetAdvice = async (goal) => {
    const progress = getGoalProgress(goal, transactions);
    const result = await generateGoalAdvice(goal, progress);
    if (result.ok) {
      setGoalAdvice(prev => ({ ...prev, [goal.id]: result.content }));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 100 }}
      >
        {/* 说明 */}
        <View style={[styles.headerCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <Ionicons name="flag" size={24} color={tc.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[styles.headerTitle, { color: tc.text }]}>消费目标</Text>
            <Text style={[styles.headerDesc, { color: tc.textMuted }]}>
              设定月度消费目标，AI 会追踪进度并给出建议
            </Text>
          </View>
        </View>

        {/* 目标列表 */}
        {goals.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="flag-outline" size={48} color={tc.textSubtle} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>还没有消费目标</Text>
            <Text style={[styles.emptyDesc, { color: tc.textMuted }]}>
              点击右下角 + 按钮设定你的第一个目标
            </Text>
          </View>
        ) : (
          <View style={styles.goalList}>
            {goals.map((goal) => {
              const progress = getGoalProgress(goal, transactions);
              const isExpanded = expandedGoal === goal.id;
              const progressColor = progress.onTrack ? tc.success : tc.danger;

              return (
                <View key={goal.id} style={[styles.goalCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                  <TouchableOpacity
                    style={styles.goalHeader}
                    onPress={() => setExpandedGoal(isExpanded ? null : goal.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.goalInfo}>
                      <Text style={[styles.goalName, { color: tc.text }]}>{goal.name}</Text>
                      {goal.category && (
                        <Text style={[styles.goalCategory, { color: tc.textMuted }]}>{goal.category}</Text>
                      )}
                    </View>
                    <View style={styles.goalRight}>
                      <Text style={[styles.goalProgress, { color: progressColor }]}>
                        {progress.percent}%
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={tc.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* 进度条 */}
                  <View style={[styles.progressBar, { backgroundColor: tc.surfaceMuted }]}>
                    <View style={[styles.progressFill, { width: `${Math.min(progress.percent, 100)}%`, backgroundColor: progressColor }]} />
                  </View>

                  {/* 详情 */}
                  {isExpanded && (
                    <View style={styles.goalDetails}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: tc.textMuted }]}>目标金额</Text>
                        <Text style={[styles.detailValue, { color: tc.text }]}>{formatMoney(goal.amount, settings.currency)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: tc.textMuted }]}>已花费</Text>
                        <Text style={[styles.detailValue, { color: tc.text }]}>{formatMoney(progress.spent, settings.currency)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: tc.textMuted }]}>剩余</Text>
                        <Text style={[styles.detailValue, { color: progress.remaining >= 0 ? tc.text : tc.danger }]}>
                          {formatMoney(progress.remaining, settings.currency)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: tc.textMuted }]}>剩余天数</Text>
                        <Text style={[styles.detailValue, { color: tc.text }]}>{progress.daysLeft} 天</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: tc.textMuted }]}>日均预算</Text>
                        <Text style={[styles.detailValue, { color: tc.text }]}>
                          {progress.dailyBudget > 0 ? formatMoney(progress.dailyBudget, settings.currency) : '已超支'}
                        </Text>
                      </View>

                      {/* AI 建议 */}
                      {goalAdvice[goal.id] ? (
                        <View style={[styles.adviceBox, { backgroundColor: tc.surfaceMuted }]}>
                          <Text style={[styles.adviceText, { color: tc.textSecondary }]}>{goalAdvice[goal.id]}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.adviceBtn, { backgroundColor: tc.accentSubtle }]}
                          onPress={() => handleGetAdvice(goal)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="sparkles" size={14} color={tc.accent} />
                          <Text style={[styles.adviceBtnText, { color: tc.accent }]}>获取 AI 建议</Text>
                        </TouchableOpacity>
                      )}

                      {/* 删除按钮 */}
                      <TouchableOpacity
                        style={[styles.deleteBtn, { backgroundColor: tc.dangerSubtle }]}
                        onPress={() => handleDeleteGoal(goal)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={14} color={tc.danger} />
                        <Text style={[styles.deleteBtnText, { color: tc.danger }]}>删除目标</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 添加按钮 */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: tc.primary }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color={tc.primaryOn} />
      </TouchableOpacity>

      {/* 添加目标弹窗 */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: tc.surface }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: tc.divider }]} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>新增消费目标</Text>

            <Text style={[styles.fieldLabel, { color: tc.textMuted }]}>目标名称</Text>
            <TextInput
              style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
              value={newGoalName}
              onChangeText={setNewGoalName}
              placeholder="例如：本月餐饮预算"
              placeholderTextColor={tc.textSubtle}
              maxLength={30}
            />

            <Text style={[styles.fieldLabel, { color: tc.textMuted }]}>目标金额</Text>
            <TextInput
              style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
              value={newGoalAmount}
              onChangeText={setNewGoalAmount}
              placeholder="0.00"
              placeholderTextColor={tc.textSubtle}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.fieldLabel, { color: tc.textMuted }]}>关联分类（可选）</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <TouchableOpacity
                style={[styles.categoryChip, { backgroundColor: !newGoalCategory ? tc.primary : tc.surfaceMuted }]}
                onPress={() => setNewGoalCategory('')}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryChipText, { color: !newGoalCategory ? tc.primaryOn : tc.text }]}>全部</Text>
              </TouchableOpacity>
              {categoryConfig.expense.slice(0, 12).map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={[styles.categoryChip, { backgroundColor: newGoalCategory === c.name ? tc.primary : tc.surfaceMuted }]}
                  onPress={() => setNewGoalCategory(c.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryChipText, { color: newGoalCategory === c.name ? tc.primaryOn : tc.text }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: tc.surfaceMuted }]}
                onPress={() => setShowAddModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: tc.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: tc.primary, flex: 1 }]}
                onPress={handleAddGoal}
                activeOpacity={0.85}
              >
                <Text style={[styles.modalBtnText, { color: tc.primaryOn }]}>添加</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.base, marginBottom: spacing.base,
    padding: spacing.base, borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  headerDesc: { fontSize: fontSize.sm, marginTop: 2 },

  emptyWrap: {
    alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  emptyDesc: { fontSize: fontSize.sm },

  goalList: { paddingHorizontal: spacing.base, gap: spacing.sm },
  goalCard: {
    borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  goalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.base,
  },
  goalInfo: { flex: 1 },
  goalName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  goalCategory: { fontSize: fontSize.xs, marginTop: 2 },
  goalRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  goalProgress: { fontSize: fontSize.md, fontWeight: fontWeight.bold },

  progressBar: { height: 4, marginHorizontal: spacing.base },
  progressFill: { height: '100%', borderRadius: 2 },

  goalDetails: {
    padding: spacing.base, paddingTop: spacing.md, gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  detailLabel: { fontSize: fontSize.sm },
  detailValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  adviceBox: {
    padding: spacing.md, borderRadius: borderRadius.sm, marginTop: spacing.sm,
  },
  adviceText: { fontSize: fontSize.sm, lineHeight: 20 },
  adviceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, borderRadius: borderRadius.sm, gap: spacing.xs, marginTop: spacing.sm,
  },
  adviceBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, borderRadius: borderRadius.sm, gap: spacing.xs, marginTop: spacing.sm,
  },
  deleteBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  fab: {
    position: 'absolute', right: spacing.base, bottom: spacing.xl,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl,
  },
  modalSheet: {
    borderRadius: borderRadius.xl, padding: spacing.xl,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: spacing.base, letterSpacing: -0.3 },
  fieldLabel: { fontSize: fontSize.xs, marginBottom: spacing.xs, letterSpacing: -0.1 },
  input: {
    borderRadius: borderRadius.md, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md, height: 44, fontSize: fontSize.md, marginBottom: spacing.md,
  },
  categoryScroll: { marginBottom: spacing.base },
  categoryChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: borderRadius.full, marginRight: spacing.xs,
  },
  categoryChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  modalBtnRow: { flexDirection: 'row', gap: spacing.sm },
  modalBtn: {
    flex: 1, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
  },
  modalBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});

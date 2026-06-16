// 璐璐记账 · 预算环形图组件（双模式）
// 模式1：整体概览 —— 总预算/已用/剩余 的甜甜圈图 + 中心数值
// 模式2：分类详情 —— 按分类展示各预算项，点击高亮
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import { formatMoney } from '../utils/currency';

const CHART_SIZE = 180;
const STROKE_WIDTH = 22;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = CHART_SIZE / 2;

const MODE_OVERVIEW = 'overview';
const MODE_CATEGORY = 'category';

export default function BudgetPieChart({
  budgets = [],
  byCategory = {},
  tc,
  categoryColors = {},
  onNavigateBudget,
  currency = 'CNY',
}) {
  const [mode, setMode] = useState(MODE_OVERVIEW);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // ─── 预算数据计算 ──────────────────────────────────────────
  const chartData = useMemo(() => {
    // 找到总预算项
    const totalBudgetItem = budgets.find(
      (b) => b.category === '__total__' && b.amount > 0
    );

    // 分类预算（排除 __total__）
    const validBudgets = budgets.filter(
      (b) => b.category && b.category !== '__total__' && b.amount > 0
    );

    // 计算所有分类已花总额
    const allSpent = Object.values(byCategory || {}).reduce((s, v) => s + v, 0);

    // 场景1：有分类预算 —— 按分类展示
    if (validBudgets.length > 0) {
      const items = validBudgets.map((b) => {
        const spent = byCategory[b.category] || 0;
        const color = categoryColors[b.category] || tc.primary;
        return {
          category: b.category,
          budget: b.amount,
          spent,
          remaining: b.amount - spent,
          isOver: spent > b.amount,
          color,
        };
      });

      items.sort((a, b) => b.budget - a.budget);

      const totalBudget = items.reduce((s, i) => s + i.budget, 0);
      const totalSpent = items.reduce((s, i) => s + i.spent, 0);
      const totalRemaining = totalBudget - totalSpent;

      let accumulatedAngle = 0;
      const segments = items.map((item, index) => {
        const proportion = totalBudget > 0 ? item.budget / totalBudget : 0;
        const arcLength = proportion * CIRCUMFERENCE;
        const rotation = (accumulatedAngle / 360) * CIRCUMFERENCE;
        accumulatedAngle += proportion * 360;

        return {
          ...item,
          index,
          proportion,
          arcLength,
          rotation,
          startAngle: rotation,
          percent: Math.round(proportion * 100),
        };
      });

      return {
        segments,
        items,
        totalBudget,
        totalSpent,
        totalRemaining,
        isOver: totalSpent > totalBudget,
      };
    }

    // 场景2：只有总预算，无分类预算 —— 整体概览模式
    if (totalBudgetItem) {
      const totalBudget = totalBudgetItem.amount;
      const totalSpent = allSpent;
      const totalRemaining = totalBudget - totalSpent;

      return {
        segments: [],
        items: [],
        totalBudget,
        totalSpent,
        totalRemaining,
        isOver: totalSpent > totalBudget,
        isTotalOnly: true,
      };
    }

    return null;
  }, [budgets, byCategory, categoryColors, tc.primary]);

  // ─── 整体概览的分段数据（已用 vs 剩余）──────────────────────
  const overviewSegments = useMemo(() => {
    if (!chartData) return null;
    const { totalBudget, totalSpent, totalRemaining, isOver } = chartData;
    if (totalBudget <= 0) return null;

    const usedPct = Math.min(totalSpent / totalBudget, 1);
    const remainPct = isOver ? 0 : Math.max(1 - usedPct, 0);

    const usedArc = usedPct * CIRCUMFERENCE;
    const remainArc = remainPct * CIRCUMFERENCE;

    return {
      used: {
        arcLength: usedArc,
        rotation: 0,
        color: isOver ? tc.danger : tc.primary,
        percent: Math.round(usedPct * 100),
      },
      remaining: {
        arcLength: remainArc,
        rotation: usedArc,
        color: tc.success,
        percent: Math.round(remainPct * 100),
      },
      totalBudget,
      totalSpent,
      totalRemaining: Math.abs(totalRemaining),
      isOver,
    };
  }, [chartData, tc]);

  // ─── 交互 ──────────────────────────────────────────────────
  const handleSegmentPress = useCallback((index) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  }, []);

  const toggleMode = useCallback(() => {
    if (chartData?.isTotalOnly) return;
    setMode((prev) => prev === MODE_OVERVIEW ? MODE_CATEGORY : MODE_OVERVIEW);
    setSelectedIndex(null);
  }, [chartData?.isTotalOnly]);

  // ─── 空状态 ────────────────────────────────────────────────
  if (!chartData) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons name="pie-chart-outline" size={28} color={tc.textSubtle} />
        </View>
        <Text style={[styles.emptyTitle, { color: tc.text }]}>暂无预算</Text>
        <Text style={[styles.emptyHint, { color: tc.textMuted }]}>
          设置每月预算，掌控消费节奏
        </Text>
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: tc.primary }]}
          onPress={onNavigateBudget}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={16} color={tc.primaryOn} />
          <Text style={[styles.emptyBtnText, { color: tc.primaryOn }]}>去设置预算</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selected = selectedIndex !== null ? chartData.segments[selectedIndex] : null;

  return (
    <View style={styles.container}>
      {/* 标题行 */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: tc.text }]}>预算概览</Text>
        {!chartData.isTotalOnly && (
          <TouchableOpacity
            style={[styles.modeToggle, { backgroundColor: tc.surfaceMuted }]}
            onPress={toggleMode}
            activeOpacity={0.7}
          >
            <Ionicons
              name={mode === MODE_OVERVIEW ? 'layers-outline' : 'grid-outline'}
              size={14}
            color={tc.textMuted}
          />
          <Text style={[styles.modeToggleText, { color: tc.textMuted }]}>
            {mode === MODE_OVERVIEW ? '分类' : '概览'}
          </Text>
        </TouchableOpacity>
        )}
      </View>

      {/* 甜甜圈图 */}
      <View style={[styles.chartWrap, { width: CHART_SIZE, height: CHART_SIZE }]}>
        <Svg width={CHART_SIZE} height={CHART_SIZE}>
          {/* 底色环 */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={tc.surfaceMuted}
            strokeWidth={STROKE_WIDTH}
          />

          {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
            // ── 整体概览模式 ──
            overviewSegments && (
              <G rotation="-90" origin={`${CENTER}, ${CENTER}`}>
                {/* 已用预算 */}
                {overviewSegments.used.arcLength > 0 && (
                  <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={overviewSegments.used.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${overviewSegments.used.arcLength} ${CIRCUMFERENCE - overviewSegments.used.arcLength}`}
                    strokeDashoffset={0}
                    strokeLinecap="butt"
                  />
                )}
                {/* 剩余预算 */}
                {overviewSegments.remaining.arcLength > 0 && (
                  <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={overviewSegments.remaining.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${overviewSegments.remaining.arcLength} ${CIRCUMFERENCE - overviewSegments.remaining.arcLength}`}
                    strokeDashoffset={-overviewSegments.used.arcLength}
                    strokeLinecap="butt"
                  />
                )}
              </G>
            )
          ) : (
            // ── 分类详情模式 ──
            <G rotation="-90" origin={`${CENTER}, ${CENTER}`}>
              {chartData.segments.map((seg) => {
                const isSelected = selected && selected.index === seg.index;
                const sw = isSelected ? STROKE_WIDTH + 4 : STROKE_WIDTH;
                const gap = chartData.segments.length > 1 ? 2 : 0;
                const dashLen = Math.max(seg.arcLength - gap, 0);

                return (
                  <Circle
                    key={seg.category}
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={sw}
                    strokeDasharray={`${dashLen} ${CIRCUMFERENCE - dashLen}`}
                    strokeDashoffset={-seg.rotation}
                    strokeLinecap="butt"
                    opacity={selected && !isSelected ? 0.45 : 1}
                    onPress={() => handleSegmentPress(seg.index)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  />
                );
              })}
            </G>
          )}
        </Svg>

        {/* 中心文字 */}
        <View style={[styles.centerOverlay, { width: CHART_SIZE, height: CHART_SIZE }]} pointerEvents="none">
          {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
            // ── 整体概览中心 ──
            <View style={styles.centerContent}>
              <Text style={[styles.centerLabel, { color: tc.textSubtle }]}>剩余预算</Text>
              <Text style={[styles.centerTotal, { color: overviewSegments?.isOver ? tc.danger : tc.text }]} numberOfLines={1}>
                {overviewSegments?.isOver ? '-' : ''}{formatMoney(overviewSegments?.totalRemaining || 0, currency)}
              </Text>
              <Text style={[styles.centerSub, { color: tc.textMuted }]}>
                {overviewSegments?.isOver ? '已超支' : `已用 ${overviewSegments?.used.percent || 0}%`}
              </Text>
            </View>
          ) : selected ? (
            // ── 分类选中态 ──
            <View style={styles.centerContent}>
              <Text style={[styles.centerCategory, { color: selected.color }]} numberOfLines={1}>
                {selected.category}
              </Text>
              <Text style={[styles.centerSpent, { color: tc.text }]} numberOfLines={1}>
                {formatMoney(selected.spent, currency)}
              </Text>
              <Text style={[styles.centerBudget, { color: tc.textMuted }]} numberOfLines={1}>
                / {formatMoney(selected.budget, currency)}
              </Text>
              {selected.isOver ? (
                <View style={[styles.centerBadge, { backgroundColor: tc.dangerSubtle }]}>
                  <Text style={[styles.centerBadgeText, { color: tc.danger }]}>
                    超支 {formatMoney(Math.abs(selected.remaining), currency)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.centerPercent, { color: tc.textSubtle }]}>
                  {selected.percent}%
                </Text>
              )}
            </View>
          ) : (
            // ── 分类默认中心 ──
            <View style={styles.centerContent}>
              <Text style={[styles.centerLabel, { color: tc.textSubtle }]}>预算</Text>
              <Text style={[styles.centerTotal, { color: tc.text }]} numberOfLines={1}>
                {formatMoney(chartData.totalSpent, currency)}
              </Text>
              <Text style={[styles.centerSub, { color: chartData.isOver ? tc.danger : tc.textMuted }]}>
                {chartData.isOver
                  ? `超支 ${formatMoney(Math.abs(chartData.totalRemaining), currency)}`
                  : `剩余 ${formatMoney(chartData.totalRemaining, currency)}`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 整体概览：已用/剩余/总预算 三项指标 */}
      {(mode === MODE_OVERVIEW || chartData.isTotalOnly) && (
        <View style={styles.overviewStats}>
          <View style={styles.overviewStatItem}>
            <View style={[styles.overviewDot, { backgroundColor: tc.primary }]} />
            <View>
              <Text style={[styles.overviewStatLabel, { color: tc.textMuted }]}>已用</Text>
              <Text style={[styles.overviewStatValue, { color: tc.text }]}>
                {formatMoney(chartData.totalSpent, currency)}
              </Text>
            </View>
            <Text style={[styles.overviewStatPct, { color: tc.textMuted }]}>
              {overviewSegments?.used.percent || 0}%
            </Text>
          </View>
          <View style={[styles.overviewStatDivider, { backgroundColor: tc.divider }]} />
          <View style={styles.overviewStatItem}>
            <View style={[styles.overviewDot, { backgroundColor: tc.success }]} />
            <View>
              <Text style={[styles.overviewStatLabel, { color: tc.textMuted }]}>剩余</Text>
              <Text style={[styles.overviewStatValue, { color: chartData.isOver ? tc.danger : tc.text }]}>
                {chartData.isOver ? '-' : ''}{formatMoney(chartData.totalRemaining < 0 ? Math.abs(chartData.totalRemaining) : chartData.totalRemaining, currency)}
              </Text>
            </View>
            <Text style={[styles.overviewStatPct, { color: tc.textMuted }]}>
              {overviewSegments?.remaining.percent || 0}%
            </Text>
          </View>
          <View style={[styles.overviewStatDivider, { backgroundColor: tc.divider }]} />
          <View style={styles.overviewStatItem}>
            <View style={[styles.overviewDot, { backgroundColor: tc.textSubtle }]} />
            <View>
              <Text style={[styles.overviewStatLabel, { color: tc.textMuted }]}>总预算</Text>
              <Text style={[styles.overviewStatValue, { color: tc.text }]}>
                {formatMoney(chartData.totalBudget, currency)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 分类详情：图例列表 */}
      {mode === MODE_CATEGORY && (
        <View style={styles.legendList}>
          {chartData.segments.map((seg) => {
            const isSelected = selected && selected.index === seg.index;
            const usedPct = seg.budget > 0 ? Math.round((seg.spent / seg.budget) * 100) : 0;
            return (
              <TouchableOpacity
                key={seg.category}
                style={[
                  styles.legendItem,
                  { backgroundColor: isSelected ? tc.surfaceMuted : 'transparent' },
                ]}
                onPress={() => handleSegmentPress(seg.index)}
                activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <View style={styles.legendInfo}>
                  <Text
                    style={[styles.legendName, { color: isSelected ? tc.text : tc.textMuted }]}
                    numberOfLines={1}
                  >
                    {seg.category}
                  </Text>
                  <View style={styles.legendBarBg}>
                    <View
                      style={[
                        styles.legendBar,
                        {
                          width: `${Math.min(usedPct, 100)}%`,
                          backgroundColor: seg.isOver ? tc.danger : seg.color,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.legendValues}>
                  <Text style={[styles.legendAmount, { color: tc.text }]} numberOfLines={1}>
                    {formatMoney(seg.spent, currency)}
                  </Text>
                  <Text style={[styles.legendBudget, { color: tc.textSubtle }]} numberOfLines={1}>
                    / {formatMoney(seg.budget, currency)}
                  </Text>
                </View>
                {seg.isOver && (
                  <View style={[styles.overTag, { backgroundColor: tc.dangerSubtle }]}>
                    <Text style={[styles.overTagText, { color: tc.danger }]}>超</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 底部快捷操作 */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          style={[styles.footerBtn, { backgroundColor: tc.surfaceMuted }]}
          onPress={onNavigateBudget}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={14} color={tc.textMuted} />
          <Text style={[styles.footerBtnText, { color: tc.textMuted }]}>管理预算</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },

  // ── 标题行 ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  modeToggleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // ── 图表 ──
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    maxWidth: RADIUS * 2 - STROKE_WIDTH + 10,
  },

  // ── 中心文字 ──
  centerLabel: {
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  centerTotal: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  centerSub: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xxs,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  centerCategory: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
    marginBottom: spacing.xxs,
  },
  centerSpent: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  centerBudget: {
    fontSize: fontSize.xs,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  centerPercent: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xxs,
  },
  centerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginTop: spacing.xxs,
  },
  centerBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  // ── 整体概览：三项指标 ──
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: 0,
  },
  overviewStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  overviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overviewStatLabel: {
    fontSize: fontSize.xs,
  },
  overviewStatValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  overviewStatPct: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
  overviewStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: spacing.sm,
  },

  // ── 分类图例列表 ──
  legendList: {
    marginTop: spacing.md,
    gap: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendInfo: {
    flex: 1,
    gap: 3,
  },
  legendName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },
  legendBarBg: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  legendBar: {
    height: '100%',
    borderRadius: 1.5,
  },
  legendValues: {
    alignItems: 'flex-end',
  },
  legendAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  legendBudget: {
    fontSize: fontSize.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  overTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  overTagText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },

  // ── 底部操作 ──
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  footerBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // ── 空状态卡片 ──
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.base,
  },
  emptyBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
});

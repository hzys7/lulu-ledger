// 小璐记账 · 预算环形图组件（美化版）
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme';
import { formatMoney } from '../utils/currency';

const CHART_SIZE = 140;
const STROKE_WIDTH = 18;
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
  const [overviewSelected, setOverviewSelected] = useState(null);

  const chartData = useMemo(() => {
    const totalBudgetItem = budgets.find(
      (b) => b.category === '__total__' && b.amount > 0
    );
    const validBudgets = budgets.filter(
      (b) => b.category && b.category !== '__total__' && b.amount > 0
    );
    const allSpent = Object.values(byCategory || {}).reduce((s, v) => s + v, 0);

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
        segments, items, totalBudget, totalSpent, totalRemaining,
        isOver: totalSpent > totalBudget,
      };
    }

    if (totalBudgetItem) {
      const totalBudget = totalBudgetItem.amount;
      const totalSpent = allSpent;
      const totalRemaining = totalBudget - totalSpent;
      return {
        segments: [], items: [], totalBudget, totalSpent, totalRemaining,
        isOver: totalSpent > totalBudget,
        isTotalOnly: true,
      };
    }

    return null;
  }, [budgets, byCategory, categoryColors, tc.primary]);

  const overviewSegments = useMemo(() => {
    if (!chartData) return null;
    const { totalBudget, totalSpent, totalRemaining, isOver } = chartData;
    if (totalBudget <= 0) return null;

    const usedPct = Math.min(totalSpent / totalBudget, 1);
    const remainPct = isOver ? 0 : Math.max(1 - usedPct, 0);
    const usedArc = usedPct * CIRCUMFERENCE;
    const remainArc = remainPct * CIRCUMFERENCE;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysLeft = Math.max(daysInMonth - dayOfMonth, 1);
    const dailyRemaining = daysLeft > 0 ? Math.abs(totalRemaining) / daysLeft : 0;

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
      totalBudget, totalSpent,
      totalRemaining: Math.abs(totalRemaining),
      isOver,
      daysLeft,
      dailyRemaining,
    };
  }, [chartData, tc]);

  const handleSegmentPress = useCallback((index) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleOverviewPress = useCallback((key) => {
    setOverviewSelected((prev) => (prev === key ? null : key));
  }, []);

  const toggleMode = useCallback(() => {
    if (chartData?.isTotalOnly) return;
    setMode((prev) => prev === MODE_OVERVIEW ? MODE_CATEGORY : MODE_OVERVIEW);
    setSelectedIndex(null);
    setOverviewSelected(null);
  }, [chartData?.isTotalOnly]);

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

      <View style={styles.mainRow}>
        {/* 左侧：饼图 */}
        <View style={[styles.chartWrap, { width: CHART_SIZE, height: CHART_SIZE }]}>
          <Svg width={CHART_SIZE} height={CHART_SIZE}>
            <Defs>
              <LinearGradient id="usedGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={overviewSegments?.isOver ? tc.danger : tc.primary} />
                <Stop offset="1" stopColor={overviewSegments?.isOver ? tc.danger : tc.primary} stopOpacity={0.7} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={CENTER} cy={CENTER} r={RADIUS}
              fill="none" stroke={tc.surfaceMuted} strokeWidth={STROKE_WIDTH}
            />

            {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
              overviewSegments && (
                <G rotation="-90" origin={`${CENTER}, ${CENTER}`}>
                  {overviewSegments.used.arcLength > 0 && (
                    <Circle
                      cx={CENTER} cy={CENTER} r={RADIUS}
                      fill="none"
                      stroke={overviewSegments.used.color}
                      strokeWidth={overviewSelected === 'used' ? STROKE_WIDTH + 3 : STROKE_WIDTH}
                      strokeDasharray={`${overviewSegments.used.arcLength} ${CIRCUMFERENCE - overviewSegments.used.arcLength}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      opacity={overviewSelected && overviewSelected !== 'used' ? 0.4 : 1}
                      onPress={() => handleOverviewPress('used')}
                    />
                  )}
                  {overviewSegments.remaining.arcLength > 0 && (
                    <Circle
                      cx={CENTER} cy={CENTER} r={RADIUS}
                      fill="none"
                      stroke={overviewSegments.remaining.color}
                      strokeWidth={overviewSelected === 'remaining' ? STROKE_WIDTH + 3 : STROKE_WIDTH}
                      strokeDasharray={`${overviewSegments.remaining.arcLength} ${CIRCUMFERENCE - overviewSegments.remaining.arcLength}`}
                      strokeDashoffset={-overviewSegments.used.arcLength}
                      strokeLinecap="round"
                      opacity={overviewSelected && overviewSelected !== 'remaining' ? 0.4 : 1}
                      onPress={() => handleOverviewPress('remaining')}
                    />
                  )}
                </G>
              )
            ) : (
              <G rotation="-90" origin={`${CENTER}, ${CENTER}`}>
                {chartData.segments.map((seg) => {
                  const isSelected = selected && selected.index === seg.index;
                  const sw = isSelected ? STROKE_WIDTH + 3 : STROKE_WIDTH;
                  const gap = chartData.segments.length > 1 ? 2 : 0;
                  const dashLen = Math.max(seg.arcLength - gap, 0);
                  return (
                    <Circle
                      key={seg.category}
                      cx={CENTER} cy={CENTER} r={RADIUS}
                      fill="none" stroke={seg.color}
                      strokeWidth={sw}
                      strokeDasharray={`${dashLen} ${CIRCUMFERENCE - dashLen}`}
                      strokeDashoffset={-seg.rotation}
                      strokeLinecap="round"
                      opacity={selected && !isSelected ? 0.4 : 1}
                      onPress={() => handleSegmentPress(seg.index)}
                    />
                  );
                })}
              </G>
            )}
          </Svg>

          <View style={[styles.centerOverlay, { width: CHART_SIZE, height: CHART_SIZE }]} pointerEvents="none">
            {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
              overviewSelected === 'used' ? (
                <View style={styles.centerContent}>
                  <Text style={[styles.centerLabel, { color: overviewSegments.used.color }]}>已用</Text>
                  <Text style={[styles.centerTotal, { color: tc.text }]} numberOfLines={1}>
                    {formatMoney(overviewSegments.totalSpent, currency, 0)}
                  </Text>
                  <Text style={[styles.centerSub, { color: tc.textMuted }]}>
                    {overviewSegments.used.percent}% 预算
                  </Text>
                </View>
              ) : overviewSelected === 'remaining' ? (
                <View style={styles.centerContent}>
                  <Text style={[styles.centerLabel, { color: overviewSegments.remaining.color }]}>剩余</Text>
                  <Text style={[styles.centerTotal, { color: overviewSegments.isOver ? tc.danger : tc.text }]} numberOfLines={1}>
                    {overviewSegments.isOver ? '-' : ''}{formatMoney(overviewSegments.totalRemaining, currency, 0)}
                  </Text>
                  <Text style={[styles.centerSub, { color: tc.textMuted }]}>
                    {overviewSegments.isOver ? '已超支' : `${overviewSegments.remaining.percent}% 可用`}
                  </Text>
                </View>
              ) : (
                <View style={styles.centerContent}>
                  <Text style={[styles.centerLabel, { color: tc.textSubtle }]}>剩余</Text>
                  <Text style={[styles.centerTotal, { color: overviewSegments?.isOver ? tc.danger : tc.text }]} numberOfLines={1}>
                    {overviewSegments?.isOver ? '-' : ''}{formatMoney(overviewSegments?.totalRemaining || 0, currency, 0)}
                  </Text>
                </View>
              )
            ) : selected ? (
              <View style={styles.centerContent}>
                <Text style={[styles.centerCategory, { color: selected.color }]} numberOfLines={1}>
                  {selected.category}
                </Text>
                <Text style={[styles.centerSpent, { color: tc.text }]} numberOfLines={1}>
                  {formatMoney(selected.spent, currency)}
                </Text>
                <Text style={[styles.centerBudget, { color: tc.textSubtle }]} numberOfLines={1}>
                  / {formatMoney(selected.budget, currency)}
                </Text>
              </View>
            ) : (
              <View style={styles.centerContent}>
                <Text style={[styles.centerLabel, { color: tc.textSubtle }]}>已用</Text>
                <Text style={[styles.centerTotal, { color: tc.text }]} numberOfLines={1}>
                  {formatMoney(chartData.totalSpent, currency)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 右侧：统计信息 */}
        <View style={styles.statsCol}>
          {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
            <>
              <TouchableOpacity
                style={[styles.statCard, overviewSelected === 'used' && { backgroundColor: tc.primary + '10', borderColor: tc.primary + '30' }]}
                onPress={() => handleOverviewPress('used')}
                activeOpacity={0.7}
              >
                <View style={[styles.statDot, { backgroundColor: overviewSegments?.used.color || tc.primary }]} />
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>已用</Text>
                <Text style={[styles.statValue, { color: tc.text }]}>
                  {formatMoney(chartData.totalSpent, currency, 0)}
                </Text>
                <Text style={[styles.statPct, { color: overviewSegments?.used.color || tc.primary }]}>
                  {overviewSegments?.used.percent || 0}%
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, overviewSelected === 'remaining' && { backgroundColor: tc.success + '10', borderColor: tc.success + '30' }]}
                onPress={() => handleOverviewPress('remaining')}
                activeOpacity={0.7}
              >
                <View style={[styles.statDot, { backgroundColor: overviewSegments?.remaining.color || tc.success }]} />
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>剩余</Text>
                <Text style={[styles.statValue, { color: chartData.isOver ? tc.danger : tc.text }]}>
                  {chartData.isOver ? '-' : ''}{formatMoney(chartData.totalRemaining < 0 ? Math.abs(chartData.totalRemaining) : chartData.totalRemaining, currency, 0)}
                </Text>
                <Text style={[styles.statPct, { color: overviewSegments?.remaining.color || tc.success }]}>
                  {overviewSegments?.remaining.percent || 0}%
                </Text>
              </TouchableOpacity>

              <View style={[styles.statCard, { backgroundColor: tc.surfaceMuted }]}>
                <View style={[styles.statDot, { backgroundColor: tc.textSubtle }]} />
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>总预算</Text>
                <Text style={[styles.statValue, { color: tc.text }]}>
                  {formatMoney(chartData.totalBudget, currency, 0)}
                </Text>
              </View>

              {overviewSegments && overviewSegments.daysLeft > 0 && (
                <View style={[styles.statCard, { backgroundColor: tc.primary + '08' }]}>
                  <Ionicons name="calendar-outline" size={12} color={tc.primary} />
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>日均可用</Text>
                  <Text style={[styles.statValueSmall, { color: tc.primary }]}>
                    {formatMoney(overviewSegments.dailyRemaining, currency, 0)}
                  </Text>
                  <Text style={[styles.statHint, { color: tc.textSubtle }]}>
                    还剩{overviewSegments.daysLeft}天
                  </Text>
                </View>
              )}
            </>
          ) : selected ? (
            <View style={[styles.statCard, { backgroundColor: tc.surfaceMuted }]}>
              <View style={[styles.statDot, { backgroundColor: selected.color }]} />
              <Text style={[styles.statLabel, { color: tc.textMuted }]}>预算</Text>
              <Text style={[styles.statValue, { color: tc.text }]}>
                {formatMoney(selected.budget, currency, 0)}
              </Text>
              {selected.isOver ? (
                <View style={[styles.overBadge, { backgroundColor: tc.dangerSubtle }]}>
                  <Text style={[styles.overBadgeText, { color: tc.danger }]}>
                    超支 {formatMoney(Math.abs(selected.remaining), currency)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.statHint, { color: tc.textSubtle }]}>
                  剩余 {formatMoney(selected.remaining, currency)}
                </Text>
              )}
            </View>
          ) : (
            <>
              <View style={[styles.statCard, { backgroundColor: tc.surfaceMuted }]}>
                <View style={[styles.statDot, { backgroundColor: tc.primary }]} />
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>已用</Text>
                <Text style={[styles.statValue, { color: tc.text }]}>
                  {formatMoney(chartData.totalSpent, currency, 0)}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: tc.surfaceMuted }]}>
                <View style={[styles.statDot, { backgroundColor: tc.success }]} />
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>剩余</Text>
                <Text style={[styles.statValue, { color: tc.text }]}>
                  {formatMoney(chartData.totalRemaining < 0 ? Math.abs(chartData.totalRemaining) : chartData.totalRemaining, currency, 0)}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 进度条 */}
      {(mode === MODE_OVERVIEW || chartData.isTotalOnly) && overviewSegments && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBg, { backgroundColor: tc.surfaceMuted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(overviewSegments.used.percent, 100)}%`,
                  backgroundColor: overviewSegments.isOver ? tc.danger : tc.primary,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* 分类详情列表 */}
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
                  <Text style={[styles.legendName, { color: isSelected ? tc.text : tc.textMuted }]} numberOfLines={1}>
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

  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },

  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },

  centerLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  centerTotal: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  centerSub: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  centerCategory: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  centerSpent: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  centerBudget: {
    fontSize: 10,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },

  statsCol: {
    flex: 1,
    gap: 6,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontSize: 11,
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  statValueSmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  statPct: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },
  statHint: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  overBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  overBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  progressWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

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

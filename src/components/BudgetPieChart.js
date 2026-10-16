// 小璐记账 · 预算环形图组件（v1.6.1 紫色风格美化）
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight, neuStyles } from '../theme';
import { formatMoney } from '../utils/currency';

const CHART_SIZE = 150;
const STROKE_WIDTH = 20;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = CHART_SIZE / 2;

const MODE_OVERVIEW = 'overview';
const MODE_CATEGORY = 'category';

const GRADIENT_COLORS = {
  primary: ['#6C63FF', '#8B83FF'],
  success: ['#34C759', '#5BD87A'],
  danger: ['#FF6B6B', '#FF8A8A'],
  warning: ['#FF9F0A', '#FFB340'],
};

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
  const animatedValue = useRef(new Animated.Value(0)).current;
  const neu = useMemo(() => neuStyles(tc), [tc]);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const chartData = useMemo(() => {
    const totalBudgetItem = budgets.find((b) => b.category === '__total__' && b.amount > 0);
    const validBudgets = budgets.filter((b) => b.category && b.category !== '__total__' && b.amount > 0);
    const allSpent = Object.values(byCategory || {}).reduce((s, v) => s + v, 0);

    // 有总预算时优先使用总预算（不论是否有分类预算）
    if (totalBudgetItem) {
      const totalBudget = totalBudgetItem.amount;
      const totalSpent = allSpent;
      const totalRemaining = totalBudget - totalSpent;
      return { segments: [], items: [], totalBudget, totalSpent, totalRemaining, isOver: totalSpent > totalBudget, isTotalOnly: true };
    }

    if (validBudgets.length > 0) {
      const items = validBudgets.map((b) => {
        const spent = byCategory[b.category] || 0;
        const color = categoryColors[b.category] || tc.primary;
        return {
          category: b.category, budget: b.amount, spent, remaining: b.amount - spent,
          isOver: spent > b.amount, color, percent: Math.round((spent / b.amount) * 100),
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
        return { ...item, index, proportion, arcLength, rotation, startAngle: rotation, percent: Math.round(proportion * 100) };
      });
      return { segments, items, totalBudget, totalSpent, totalRemaining, isOver: totalSpent > totalBudget };
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
    const dailyRemaining = isOver ? 0 : (daysLeft > 0 ? totalRemaining / daysLeft : 0);
    let healthScore = 100;
    if (usedPct > 0.8) healthScore = Math.max(0, 100 - (usedPct - 0.8) * 500);
    if (isOver) healthScore = 0;
    return {
      used: { arcLength: usedArc, rotation: 0, color: isOver ? tc.danger : tc.primary, percent: Math.round(usedPct * 100) },
      remaining: { arcLength: remainArc, rotation: usedArc, color: tc.success, percent: Math.round(remainPct * 100) },
      totalBudget, totalSpent, totalRemaining: Math.abs(totalRemaining), isOver, daysLeft, dailyRemaining, healthScore, usedPct,
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

  const getHealthColor = (score) => {
    if (score >= 70) return '#34D399';
    if (score >= 40) return '#FF9F0A';
    return '#FF6B6B';
  };

  if (!chartData) {
    return (
      <View style={[styles.emptyCard, neu.raised]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: tc.iconBg }]}>
          <Ionicons name="pie-chart-outline" size={32} color={tc.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: tc.text }]}>暂无预算</Text>
        <Text style={[styles.emptyHint, { color: tc.textMuted }]}>
          设置每月预算，掌控消费节奏
        </Text>
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: tc.primary, shadowColor: tc.primary, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 }]}
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
    <Animated.View style={[styles.container, neu.raisedLg, { opacity: animatedValue }]}>
      {/* 装饰盾牌 */}
      <View style={styles.shieldDeco}>
        <Ionicons name="shield-checkmark" size={48} color={tc.starColorLight} />
      </View>

      {/* 头部 */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: tc.text }]}>预算概览</Text>
          {overviewSegments && (
            <View style={[styles.healthBadge, { backgroundColor: getHealthColor(overviewSegments.healthScore) + '20' }]}>
              <Text style={[styles.healthText, { color: getHealthColor(overviewSegments.healthScore) }]}>
                {overviewSegments.healthScore >= 70 ? '健康' : overviewSegments.healthScore >= 40 ? '注意' : '超支'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.mainRow}>
        {/* 左侧：饼图 */}
        <View style={[styles.chartWrap, { width: CHART_SIZE, height: CHART_SIZE }]}>
          <Svg width={CHART_SIZE} height={CHART_SIZE}>
            <Defs>
              <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#F3F0FF" stopOpacity={0.5} />
                <Stop offset="1" stopColor="#F3F0FF" stopOpacity={0.3} />
              </LinearGradient>
              <LinearGradient id="usedGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={GRADIENT_COLORS.primary[0]} />
                <Stop offset="1" stopColor={GRADIENT_COLORS.primary[1]} />
              </LinearGradient>
              <LinearGradient id="remainGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={GRADIENT_COLORS.success[0]} />
                <Stop offset="1" stopColor={GRADIENT_COLORS.success[1]} />
              </LinearGradient>
            </Defs>
            <Circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="url(#bgGrad)" strokeWidth={STROKE_WIDTH} />
            {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
              overviewSegments && (
                <G rotation="-90" origin={`${CENTER}, ${CENTER}`}>
                  {overviewSegments.used.arcLength > 0 && (
                    <Circle
                      cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="url(#usedGrad)"
                      strokeWidth={overviewSelected === 'used' ? STROKE_WIDTH + 4 : STROKE_WIDTH}
                      strokeDasharray={`${overviewSegments.used.arcLength} ${CIRCUMFERENCE - overviewSegments.used.arcLength}`}
                      strokeDashoffset={0} strokeLinecap="round"
                      opacity={overviewSelected && overviewSelected !== 'used' ? 0.4 : 1}
                      onPress={() => handleOverviewPress('used')}
                    />
                  )}
                  {overviewSegments.remaining.arcLength > 0 && (
                    <Circle
                      cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="url(#remainGrad)"
                      strokeWidth={overviewSelected === 'remaining' ? STROKE_WIDTH + 4 : STROKE_WIDTH}
                      strokeDasharray={`${overviewSegments.remaining.arcLength} ${CIRCUMFERENCE - overviewSegments.remaining.arcLength}`}
                      strokeDashoffset={-overviewSegments.used.arcLength} strokeLinecap="round"
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
                  const sw = isSelected ? STROKE_WIDTH + 4 : STROKE_WIDTH;
                  const gap = chartData.segments.length > 1 ? 3 : 0;
                  const dashLen = Math.max(seg.arcLength - gap, 0);
                  return (
                    <Circle
                      key={seg.category} cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={seg.color}
                      strokeWidth={sw} strokeDasharray={`${dashLen} ${CIRCUMFERENCE - dashLen}`}
                      strokeDashoffset={-seg.rotation} strokeLinecap="round"
                      opacity={selected && !isSelected ? 0.3 : 1}
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
                  <Text style={[styles.centerLabel, { color: tc.primary }]}>已用</Text>
                  <Text style={[styles.centerTotal, { color: tc.text }]} numberOfLines={1}>{formatMoney(overviewSegments.totalSpent, currency, 0)}</Text>
                  <Text style={[styles.centerSub, { color: tc.textMuted }]}>{overviewSegments.used.percent}% 预算</Text>
                </View>
              ) : overviewSelected === 'remaining' ? (
                <View style={styles.centerContent}>
                  <Text style={[styles.centerLabel, { color: tc.success }]}>剩余</Text>
                  <Text style={[styles.centerTotal, { color: overviewSegments?.isOver ? tc.danger : tc.text }]} numberOfLines={1}>
                    {overviewSegments.isOver ? '-' : ''}{formatMoney(overviewSegments.totalRemaining, currency, 0)}
                  </Text>
                  <Text style={[styles.centerSub, { color: tc.textMuted }]}>{overviewSegments.isOver ? '已超支' : `${overviewSegments.remaining.percent}% 可用`}</Text>
                </View>
              ) : (
                <View style={styles.centerContent}>
                  <Text style={[styles.centerLabelGray, { color: tc.textMuted }]}>剩余</Text>
                  <Text style={[styles.centerTotal, { color: overviewSegments?.isOver ? tc.danger : tc.text }]} numberOfLines={1}>
                    {overviewSegments?.isOver ? '-' : ''}{formatMoney(overviewSegments?.totalRemaining || 0, currency, 0)}
                  </Text>
                  <Text style={[styles.centerSubBudget, { color: tc.primary, backgroundColor: tc.primarySubtle }]}>总预算 {formatMoney(overviewSegments?.totalBudget || 0, currency, 0)}</Text>
                </View>
              )
            ) : selected ? (
              <View style={styles.centerContent}>
                <View style={[styles.centerDot, { backgroundColor: selected.color }]} />
                <Text style={[styles.centerCategory, { color: tc.text }]} numberOfLines={1}>{selected.category}</Text>
                <Text style={[styles.centerSpent, { color: tc.text }]} numberOfLines={1}>{formatMoney(selected.spent, currency)}</Text>
                <Text style={[styles.centerBudget, { color: tc.textMuted }]}>/ {formatMoney(selected.budget, currency)}</Text>
              </View>
            ) : (
              <View style={styles.centerContent}>
                <Text style={[styles.centerLabelGray, { color: tc.textMuted }]}>已用</Text>
                <Text style={[styles.centerTotal, { color: tc.text }]} numberOfLines={1}>{formatMoney(chartData.totalSpent, currency)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 右侧：统计卡片 */}
        <View style={styles.statsCol}>
          {(mode === MODE_OVERVIEW || chartData.isTotalOnly) ? (
            <>
              <TouchableOpacity
                style={[styles.statCard, overviewSelected === 'used' && { backgroundColor: tc.primarySubtle }]}
                onPress={() => handleOverviewPress('used')} activeOpacity={0.7}
              >
                <View style={[styles.statDot, { backgroundColor: tc.primary }]} />
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>已用</Text>
                  <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(chartData.totalSpent, currency, 0)}</Text>
                </View>
                <Text style={[styles.statPct, { color: tc.primary }]}>{overviewSegments?.used.percent || 0}%</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, overviewSelected === 'remaining' && { backgroundColor: tc.successSubtle }]}
                onPress={() => handleOverviewPress('remaining')} activeOpacity={0.7}
              >
                <View style={[styles.statDot, { backgroundColor: tc.success }]} />
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>剩余</Text>
                  <Text style={[styles.statValue, { color: chartData.isOver ? tc.danger : tc.text }]}>
                    {chartData.isOver ? '-' : ''}{formatMoney(chartData.totalRemaining < 0 ? Math.abs(chartData.totalRemaining) : chartData.totalRemaining, currency, 0)}
                  </Text>
                </View>
                <Text style={[styles.statPct, { color: tc.success }]}>{overviewSegments?.remaining.percent || 0}%</Text>
              </TouchableOpacity>

              {overviewSegments && overviewSegments.daysLeft > 0 && (
                <View style={[styles.dailyCard, { backgroundColor: tc.primarySubtle }]}>
                  <Ionicons name="calendar-outline" size={14} color={tc.primary} />
                  <View style={styles.statInfo}>
                    <Text style={[styles.statLabel, { color: tc.textMuted }]}>日均可用</Text>
                    <Text style={[styles.statValueSmall, { color: tc.primary }]}>{formatMoney(overviewSegments.dailyRemaining, currency, 0)}</Text>
                  </View>
                  <Text style={[styles.statHint, { color: tc.textMuted }]}>{overviewSegments.daysLeft}天</Text>
                </View>
              )}
            </>
          ) : selected ? (
            <View style={[styles.statCard, { backgroundColor: tc.cardSubtle }]}>
              <View style={[styles.statDot, { backgroundColor: selected.color }]} />
              <View style={styles.statInfo}>
                <Text style={[styles.statLabel, { color: tc.textMuted }]}>预算</Text>
                <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(selected.budget, currency, 0)}</Text>
              </View>
              {selected.isOver ? (
                <View style={[styles.overBadge, { backgroundColor: tc.dangerSubtle }]}>
                  <Text style={[styles.overBadgeText, { color: tc.danger }]}>超支</Text>
                </View>
              ) : (
                <Text style={[styles.statHint, { color: tc.textMuted }]}>{selected.percent}%</Text>
              )}
            </View>
          ) : (
            <>
              <View style={[styles.statCard, { backgroundColor: tc.cardSubtle }]}>
                <View style={[styles.statDot, { backgroundColor: tc.primary }]} />
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>已用</Text>
                  <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(chartData.totalSpent, currency, 0)}</Text>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: tc.cardSubtle }]}>
                <View style={[styles.statDot, { backgroundColor: tc.success }]} />
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: tc.textMuted }]}>剩余</Text>
                  <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(chartData.totalRemaining < 0 ? Math.abs(chartData.totalRemaining) : chartData.totalRemaining, currency, 0)}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 进度条 */}
      {(mode === MODE_OVERVIEW || chartData.isTotalOnly) && overviewSegments && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBg, neu.inset]}>
            <View style={[styles.progressFill, { width: `${Math.min(overviewSegments.used.percent, 100)}%`, backgroundColor: tc.primary }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabel, { color: tc.textMuted }]}>0%</Text>
            <Text style={[styles.progressLabel, { color: tc.textMuted }]}>{overviewSegments.used.percent}%</Text>
            <Text style={[styles.progressLabel, { color: tc.textMuted }]}>100%</Text>
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
                style={[styles.legendItem, isSelected && { backgroundColor: tc.primarySubtle }]}
                onPress={() => handleSegmentPress(seg.index)} activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <View style={styles.legendInfo}>
                  <View style={styles.legendHeader}>
                    <Text style={[styles.legendName, { color: isSelected ? tc.text : tc.textMuted }]} numberOfLines={1}>{seg.category}</Text>
                    {seg.isOver && <View style={[styles.overTag, { backgroundColor: tc.dangerSubtle }]}><Text style={[styles.overTagText, { color: tc.danger }]}>超支</Text></View>}
                  </View>
                  <View style={[styles.legendBarBg, { backgroundColor: tc.surfaceSubtle }]}>
                    <View style={[styles.legendBar, { width: `${Math.min(usedPct, 100)}%`, backgroundColor: seg.isOver ? tc.danger : seg.color }]} />
                  </View>
                </View>
                <View style={styles.legendValues}>
                  <Text style={[styles.legendAmount, { color: tc.text }]} numberOfLines={1}>{formatMoney(seg.spent, currency)}</Text>
                  <Text style={[styles.legendBudget, { color: tc.textMuted }]} numberOfLines={1}>/ {formatMoney(seg.budget, currency)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 底部按钮 */}
      <View style={styles.footerRow}>
        <TouchableOpacity style={[styles.footerBtn, { backgroundColor: tc.iconBg }]} onPress={onNavigateBudget} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={14} color={tc.primary} />
          <Text style={[styles.footerBtnText, { color: tc.primary }]}>管理预算</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    position: 'relative',
    overflow: 'hidden',
  },
  shieldDeco: {
    position: 'absolute',
    top: 12,
    right: 16,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  healthBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  healthText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
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
    marginBottom: 3,
  },
  centerLabelGray: {
    fontSize: 10,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  centerDot: {
    width: 6, height: 6, borderRadius: 3, marginBottom: 4,
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
    marginTop: 2,
  },
  centerSubBudget: {
    fontSize: 9,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  centerCategory: {
    fontSize: fontSize.sm,
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
    marginTop: 2,
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
  },
  statCardActive: {},
  statCardActiveGreen: {},
  statDot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
    marginBottom: 1,
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
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },
  statHint: {
    fontSize: fontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  overBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  overBadgeText: {
    fontSize: 10, fontWeight: fontWeight.semibold,
  },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  progressWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  progressLabel: {
    fontSize: 9,
    fontVariant: ['tabular-nums'],
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
  legendItemSelected: {},
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendInfo: { flex: 1, gap: 4 },
  legendHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendName: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  legendNameSelected: {},
  legendBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  legendBar: { height: '100%', borderRadius: 2 },
  legendValues: { alignItems: 'flex-end' },
  legendAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  legendBudget: { fontSize: fontSize.xs },
  overTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: borderRadius.xs },
  overTagText: { fontSize: 9, fontWeight: fontWeight.bold },
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
    fontWeight: fontWeight.semibold,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  emptyHint: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
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
  },
});

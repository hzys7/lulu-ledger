// 鹿鹿记账 · 统计
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Circle, Line, G } from 'react-native-svg';
import { useFinance } from '../context/FinanceContext';
import { EmptyState, SectionHeader } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
} from '../theme';
import PieRing from '../components/PieRing';

const screenWidth = Dimensions.get('window').width;

export default function StatisticsScreen({ navigation }) {
  const { transactions, settings, getMonthSummary } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();
  const [dataType, setDataType] = useState('expense');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  // 上面两个是 selectedYear/Month，这个是当前时间
  const _now = new Date();
  const currentYear = _now.getFullYear();
  const currentMonth = _now.getMonth();
  const canGoNext = selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth);

  function goPrevMonth() {
    setSelectedMonth((m) => (m === 0 ? 11 : m - 1));
    setSelectedYear((y) => (selectedMonth === 0 ? y - 1 : y));
    setSelectedDay(null);
  }
  function goNextMonth() {
    if (!canGoNext) return;
    setSelectedMonth((m) => (m === 11 ? 0 : m + 1));
    setSelectedYear((y) => (selectedMonth === 11 ? y + 1 : y));
    setSelectedDay(null);
  }

  const monthSummary = useMemo(
    () => getMonthSummary(selectedYear, selectedMonth),
    [transactions, selectedYear, selectedMonth],
  );

  const chartPalette = tc.palette;

  // 上月同期总结
  const lastMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const lastMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const lastMonthSummary = useMemo(
    () => getMonthSummary(lastMonthYear, lastMonth),
    [transactions, lastMonthYear, lastMonth],
  );

  const totalAmount = dataType === 'expense' ? monthSummary.expense : monthSummary.income;
  const lastTotal = dataType === 'expense' ? lastMonthSummary.expense : lastMonthSummary.income;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth();
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const dailyAvg = elapsedDays > 0 ? totalAmount / elapsedDays : 0;
  const diffVsLast = totalAmount - lastTotal;

  // 共享过滤：按年月 + 类型筛选当月交易，消除 dailyTrend 和 topTransactions 中的重复 O(n) 过滤
  const filteredMonthTx = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        d.getFullYear() === selectedYear &&
        d.getMonth() === selectedMonth &&
        t.type === dataType
      );
    });
  }, [transactions, selectedYear, selectedMonth, dataType]);

  // 分类占比
  const categoryItems = useMemo(() => {
    const categoryData = dataType === 'expense' ? monthSummary.byCategory : monthSummary.incomeByCategory || {};
    return Object.entries(categoryData)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        amount: value,
        color: chartPalette[index % chartPalette.length],
        percent: totalAmount > 0 ? Math.round((value / totalAmount) * 100) : 0,
      }));
  }, [monthSummary, dataType, chartPalette, totalAmount]);

  // 每日趋势数据（折线图用）
  const dailyTrend = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0);
    filteredMonthTx.forEach((t) => {
      arr[new Date(t.date).getDate() - 1] += t.amount;
    });
    return arr.map((v, i) => ({ day: i + 1, value: v }));
  }, [filteredMonthTx, daysInMonth]);

  // 月支出对比（最近 5 个月 + 本月，共 6 根）
  const monthlyItems = useMemo(() => {
    const today = new Date();
    const curY = today.getFullYear();
    const curM = today.getMonth();
    const items = [];
    for (let i = 5; i >= 0; i--) {
      let m = curM - i;
      let y = curY;
      if (m < 0) { y = curY - 1; m = 12 + m; }
      const s = getMonthSummary(y, m);
      const v = dataType === 'expense' ? s.expense : s.income;
      items.push({ month: m + 1, year: y, value: v, label: m + 1 + '月' });
    }
    return items;
  }, [transactions, selectedYear, dataType]);

  // 本月支出排行（按金额倒序）
  const topTransactions = useMemo(() => {
    // 拷贝后再排序，不修改共享的 filteredMonthTx 引用
    return [...filteredMonthTx]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredMonthTx]);

  const totalLabel = dataType === 'expense' ? '本月支出' : '本月收入';
  const hasData = totalAmount > 0;

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.brand, { color: tc.textMuted }]}>{'收支报表'}</Text>
            <Text style={[styles.title, { color: tc.text }]}>{'统计'}</Text>
          </View>
        </View>

        {/* 月份切换 + 收支切换 */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={goPrevMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={tc.textMuted} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: tc.text }]}>
            {selectedYear}.{String(selectedMonth + 1).padStart(2, '0')}
          </Text>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={goNextMonth}
            disabled={!canGoNext}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={canGoNext ? tc.textMuted : tc.divider}
            />
          </TouchableOpacity>
          <View style={[styles.segment, { backgroundColor: tc.surfaceMuted }]}>
            <TouchableOpacity
              style={[styles.segmentItem, dataType === 'expense' && styles.segmentItemActive]}
              onPress={() => { setDataType('expense'); setSelectedDay(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: dataType === 'expense' ? tc.text : tc.textMuted }]}>
                {'支出'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, dataType === 'income' && styles.segmentItemActive]}
              onPress={() => { setDataType('income'); setSelectedDay(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: dataType === 'income' ? tc.text : tc.textMuted }]}>
                {'收入'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasData ? (
          <>
            {/* AI 月度复盘入口 */}
            <TouchableOpacity
              style={[styles.aiCard, { backgroundColor: tc.accentSubtle, borderColor: tc.accent }]}
              onPress={() => navigation?.navigate('AiMonthlyReport', { year: selectedYear, month: selectedMonth })}
              activeOpacity={0.7}
            >
              <View style={styles.aiIconWrap}>
                <Ionicons name="sparkles" size={18} color={tc.accent} />
              </View>
              <View style={styles.aiTextWrap}>
                <Text style={[styles.aiTitle, { color: tc.text }]}>
                  ✨ {selectedMonth + 1}月 AI 月度复盘
                </Text>
                <Text style={[styles.aiSubtitle, { color: tc.textMuted }]}>
                  {"AI 读取本月账目，生成中文复盘报告"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.accent} />
            </TouchableOpacity>

            {/* 4 格汇总数字 */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCell, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
                <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>{selectedMonth + 1}月{dataType === 'expense' ? '支出' : '收入'}(元)</Text>
                <Text style={[styles.summaryAmount, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)}
                </Text>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
                <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>日均{dataType === 'expense' ? '支出' : '收入'}(元)</Text>
                <Text style={[styles.summaryAmount, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)}
                </Text>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
                <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>比上月{dataType === 'expense' ? '支出' : '收入'}(元)</Text>
                <Text style={[styles.summaryAmount, { color: diffVsLast > 0 ? tc.danger : tc.success }]} numberOfLines={1} adjustsFontSizeToFit>
                  {diffVsLast >= 0 ? '+' : ''}{diffVsLast.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
                <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>{'收支结余'}({'元'})</Text>
                <Text style={[styles.summaryAmount, { color: monthSummary.balance >= 0 ? tc.success : tc.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                  {monthSummary.balance.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* 6 月支出趋势 - 折线图 */}
            <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: tc.text }]}>
                  {selectedMonth + 1}月{dataType === 'expense' ? '支出' : '收入'}趋势
                </Text>
                <Text style={[styles.cardUnit, { color: tc.textSubtle }]}>{'元'}</Text>
              </View>
              {selectedDay ? (
                <View style={styles.dayHintRow}>
                  <Text style={[styles.dayHintText, { color: tc.textMuted }]}>
                    {selectedMonth + 1}月{selectedDay}日 · {formatMoney((dailyTrend.find(d => d.day === selectedDay) || { value: 0 }).value, settings.currency).replace('¥', '')}元
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={tc.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.dayHintText, { color: tc.textSubtle, marginBottom: 4 }]}>
                  {'点击折线查看单日数据'}
                </Text>
              )}
              <LineChartView
                  data={dailyTrend}
                  accent={tc.primary}
                  muted={tc.textSubtle}
                  divider={tc.divider}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                />
            </View>

            {/* 6 月支出分类构成 - 环形 + 排行列表 */}
            <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: tc.text }]}>
                  {selectedMonth + 1}月{dataType === 'expense' ? '支出' : '收入'}分类构成
                </Text>
                <TouchableOpacity>
                  <Text style={[styles.cardSublink, { color: tc.textMuted }]}>{'主分类'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pieRow}>
                <PieRing
                  data={categoryItems.map(it => ({ value: it.amount, color: it.color }))}
                  size={150}
                  thickness={26}
                  center={(
                    <View style={styles.pieCenter}>
                      <Text style={[styles.pieCenterLabel, { color: tc.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                        {totalLabel}
                      </Text>
                      <Text style={[styles.pieCenterAmount, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {formatMoney(totalAmount, settings.currency).replace('¥', '')}
                      </Text>
                    </View>
                  )}
                />

              </View>
              {/* 排行列表（前 3） */}
              <View style={styles.rankList}>
                {categoryItems.slice(0, 3).map((item, idx) => (
                  <View key={item.name} style={styles.rankRow}>
                    <Text style={[styles.rankIndex, { color: tc.textMuted }]}>{idx + 1}</Text>
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.rankName, { color: tc.text }]}>{item.name}</Text>
                    <Text style={[styles.rankPercent, { color: tc.textMuted }]}>{item.percent}%</Text>
                    <Text style={[styles.rankAmount, { color: tc.text }]} numberOfLines={1}>
                      -{formatMoney(item.amount, settings.currency).replace('¥', '')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 月支出对比 - 柱状图 */}
            <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: tc.text }]}>{'月支出对比'}</Text>
              </View>
              <BarChartRow
                  items={monthlyItems}
                  accent={tc.primary}
                  muted={tc.textSubtle}
                  divider={tc.divider}
                  textMuted={tc.textMuted}
                  text={tc.text}
                  selectedKey={selectedYear + '_' + (selectedMonth + 1)}
                  onSelect={(d) => {
                    setSelectedYear(d.year);
                    setSelectedMonth(d.month - 1);
                    setSelectedDay(null);
                  }}
                />
            </View>

            {/* 本月支出排行 */}
            {topTransactions.length > 0 && (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    {selectedYear}年{selectedMonth + 1}月{dataType === 'expense' ? '支出' : '收入'}排行
                  </Text>
                </View>
                <View>
                  {topTransactions.map((tx, i) => {
                    const item = categoryItems.find(c => c.name === tx.category);
                    return (
                      <View key={tx.id} style={[styles.txRow, i < topTransactions.length - 1 && { borderBottomColor: tc.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                        <View style={[styles.colorDot, { backgroundColor: item?.color || tc.textSubtle }]} />
                        <View style={styles.txInfo}>
                          <Text style={[styles.txCategory, { color: tc.text }]} numberOfLines={1}>{tx.category}</Text>
                          {tx.note ? (
                            <Text style={[styles.txNote, { color: tc.textMuted }]} numberOfLines={1}>
                              {new Date(tx.date).toLocaleDateString('zh-CN')} · {tx.note}
                            </Text>
                          ) : (
                            <Text style={[styles.txNote, { color: tc.textMuted }]} numberOfLines={1}>
                              {new Date(tx.date).toLocaleDateString('zh-CN')}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.txAmount, { color: tc.text }]}>
                          {dataType === 'expense' ? '-' : '+'}{formatMoney(tx.amount, settings.currency).replace('¥', '')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="bar-chart-outline"
              title={'暂无数据'}
              subtitle={'本月还没有记录，快去记一笔吧'}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ===== 折线图组件 =====
function LineChartView({ data, accent, muted, divider, selectedDay, onSelectDay }) {
  const width = screenWidth - spacing.base * 2 - spacing.base * 2;
  const height = 140;
  const padding = { top: 16, right: 8, bottom: 22, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + innerH - (d.value / max) * innerH;
    return { x, y, v: d.value, day: d.day };
  });

  // 最大点位置
  let maxIdx = 0;
  values.forEach((v, i) => { if (v > values[maxIdx]) maxIdx = i; });

  // 折线路径
  const polylinePoints = points.map(p => p.x + ',' + p.y).join(' ');

  // X 轴标签
  const labels = [];
  if (data.length > 0) {
    labels.push({ x: padding.left, label: '1' });
    if (data.length > 2) {
      labels.push({ x: padding.left + innerW / 2, label: String(Math.round(data.length / 2)) });
    }
    labels.push({ x: padding.left + innerW, label: String(data.length) });
  }

  // 选中点
  const selIdx = selectedDay ? data.findIndex(d => d.day === selectedDay) : -1;
  const selPoint = selIdx >= 0 ? points[selIdx] : null;

  return (
    <View>
      <View
        style={{ width, height }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(evt) => {
          const x = evt.nativeEvent.locationX;
          if (stepX <= 0) return;
          const idx = Math.round((x - padding.left) / stepX);
          const clamped = Math.max(0, Math.min(data.length - 1, idx));
          onSelectDay && onSelectDay(data[clamped] ? data[clamped].day : null);
        }}
      >
        <Svg width={width} height={height}>
          {[0.25, 0.5, 0.75].map((p, i) => (
            <Line
              key={'g' + i}
              x1={padding.left}
              y1={padding.top + innerH * p}
              x2={padding.left + innerW}
              y2={padding.top + innerH * p}
              stroke={divider}
              strokeWidth={1}
              strokeDasharray="2,4"
            />
          ))}
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            values[i] > 0 ? (
              <Circle key={'p' + i} cx={p.x} cy={p.y} r={2.5} fill={accent} />
            ) : null
          ))}
          {values[maxIdx] > 0 && (
            <Circle
              cx={points[maxIdx].x}
              cy={points[maxIdx].y}
              r={4}
              fill={accent}
            />
          )}
          {selPoint && values[selIdx] > 0 && (
            <G>
              <Line
                x1={selPoint.x}
                y1={padding.top}
                x2={selPoint.x}
                y2={padding.top + innerH}
                stroke={accent}
                strokeWidth={1}
                strokeDasharray="2,3"
                opacity={0.5}
              />
              <Circle
                cx={selPoint.x}
                cy={selPoint.y}
                r={5}
                fill={accent}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </G>
          )}
        </Svg>
      </View>
      <View style={styles.lineLabels}>
        {labels.map((l, i) => (
          <Text key={i} style={[styles.lineLabel, { color: muted }]}>{l.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ===== 柱状图行（月度对比用） =====
function BarChartRow({ items, accent, muted, divider, textMuted, text, selectedKey, onSelect }) {
  const values = items.map(i => i.value);
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barChartRow}>
      {items.map((d, i) => {
        const key = d.year + '_' + d.month;
        const isSelected = selectedKey === key;
        const heightPct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <TouchableOpacity
            key={key}
            activeOpacity={0.7}
            style={styles.barCol}
            onPress={() => onSelect && onSelect(d)}
          >
            <Text style={[styles.barValue, { color: isSelected ? text : textMuted }]}>
              {d.value > 0 ? (d.value >= 1000 ? (Math.round(d.value / 100) / 10 + 'k') : Math.round(d.value)) : ''}
            </Text>
            {d.value > 0 ? (
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(heightPct * 0.8, 8),
                    backgroundColor: accent,
                    opacity: isSelected ? 1 : 0.35,
                    borderRadius: isSelected ? 4 : 3,
                  },
                ]}
              />
            ) : (
              <View style={[styles.barEmpty, { backgroundColor: divider }]} />
            )}
            <Text style={[styles.barLabel, { color: isSelected ? text : muted, fontWeight: isSelected ? '600' : '400' }]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingBottom: spacing.xl },

  headerRow: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  brand: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.6, marginTop: 2 },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  monthSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 4,
  },
  monthSwitchText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
  monthText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2, paddingHorizontal: spacing.sm },
  monthArrow: { padding: 4 },

  segment: { flexDirection: 'row', borderRadius: borderRadius.full, padding: 3 },
  segmentItem: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: borderRadius.full },
  segmentItemActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: -0.2 },

  // AI 占位卡
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTextWrap: { flex: 1 },
  aiTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  aiSubtitle: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },

  // 4 格汇总
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  summaryCell: {
    width: (screenWidth - spacing.base * 2 - spacing.sm) / 2,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  summaryAmount: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },

  // 卡片
  card: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  cardUnit: { fontSize: fontSize.xs },
  cardSublink: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // 折线图标签
  lineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: 2,
  },
  lineLabel: {
    fontSize: fontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  dayHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: 4,
  },
  dayHintText: {
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },

  // Pie + 排行
  pieRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
    position: 'relative',
  },
  pieCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  pieCenterLabel: { fontSize: fontSize.xs },
  pieCenterAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  rankList: { marginTop: spacing.base },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rankIndex: { fontSize: fontSize.md, width: 16, fontWeight: fontWeight.medium },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  rankName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, flex: 0, width: 60, letterSpacing: -0.2 },
  rankPercent: { fontSize: fontSize.xs, width: 35, textAlign: 'right' },
  rankAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },

  // 柱状图
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: spacing.md,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '60%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barEmpty: {
    width: '60%',
    height: 2,
    borderRadius: 1,
    opacity: 0.3,
  },
  barValue: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  // 本月赘越排行
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  txInfo: { flex: 1 },
  txCategory: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  txNote: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },
  txAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },
});

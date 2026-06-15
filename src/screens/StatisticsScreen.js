// 璐璐记账 · 统计（周报 / 月报 / 年报）
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
import Svg, { Polyline, Circle, Line, G, Rect } from 'react-native-svg';
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
import { shareMonthlyReport, shareYearlyReport } from '../utils/shareReport';

const screenWidth = Dimensions.get('window').width;

// ─── 周次辅助 ───────────────────────────────────────────
function getMonday(date, offset = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekLabel(monday) {
  const start = new Date(monday);
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const fmt = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

function isSameWeek(d1, d2) {
  const m1 = getMonday(d1);
  const m2 = getMonday(d2);
  return m1.getTime() === m2.getTime();
}

// ─── 汇总计算 ───────────────────────────────────────────
function calcSummary(txList, type) {
  const filtered = txList.filter(t => t.type === type);
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const byCategory = {};
  filtered.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });
  return { total, byCategory };
}

function calcBalance(txList) {
  const income = txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return income - expense;
}

// ─── 颜色映射 ───────────────────────────────────────────
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const WEEKDAY_COLORS = [
  '#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA', '#F06595',
];

// ============================================================
//  主组件
// ============================================================
export default function StatisticsScreen({ navigation }) {
  const { transactions, settings, getMonthSummary } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  // ── 档期选择 ──
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'year'
  const [dataType, setDataType] = useState('expense');

  // 月
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  // 周
  const [weekOffset, setWeekOffset] = useState(0);

  // 年
  const [yearOffset, setYearOffset] = useState(0);

  const _now = new Date();
  const currentYear = _now.getFullYear();
  const currentMonth = _now.getMonth();

  // ── 切换档期时重置 ──
  function switchPeriod(p) {
    setPeriod(p);
    setSelectedDay(null);
    if (p === 'week') setWeekOffset(0);
    if (p === 'year') setYearOffset(0);
    if (p === 'month') {
      setSelectedMonth(_now.getMonth());
      setSelectedYear(_now.getFullYear());
    }
  }

  // =============== 月报数据 ===============
  const canGoNext = selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth);
  const goPrevMonth = () => {
    setSelectedMonth(m => (m === 0 ? 11 : m - 1));
    setSelectedYear(y => (selectedMonth === 0 ? y - 1 : y));
    setSelectedDay(null);
  };
  const goNextMonth = () => {
    if (!canGoNext) return;
    setSelectedMonth(m => (m === 11 ? 0 : m + 1));
    setSelectedYear(y => (selectedMonth === 11 ? y + 1 : y));
    setSelectedDay(null);
  };

  const monthSummary = useMemo(
    () => getMonthSummary(selectedYear, selectedMonth),
    [transactions, selectedYear, selectedMonth],
  );
  const chartPalette = tc.palette;

  const lastMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const lastMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const lastMonthSummary = useMemo(
    () => getMonthSummary(lastMonthYear, lastMonth),
    [transactions, lastMonthYear, lastMonth],
  );

  const monthTotalAmount = dataType === 'expense' ? monthSummary.expense : monthSummary.income;
  const lastMonthTotal = dataType === 'expense' ? lastMonthSummary.expense : lastMonthSummary.income;
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const elapsedDays = isCurrentMonth ? _now.getDate() : daysInMonth;
  const monthDailyAvg = elapsedDays > 0 ? monthTotalAmount / elapsedDays : 0;
  const monthDiffVsLast = monthTotalAmount - lastMonthTotal;

  const filteredMonthTx = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && t.type === dataType;
    });
  }, [transactions, selectedYear, selectedMonth, dataType]);

  const monthCategoryItems = useMemo(() => {
    const catData = dataType === 'expense' ? monthSummary.byCategory : monthSummary.incomeByCategory || {};
    return Object.entries(catData)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, amount: value,
        color: chartPalette[i % chartPalette.length],
        percent: monthTotalAmount > 0 ? Math.round((value / monthTotalAmount) * 100) : 0,
      }));
  }, [monthSummary, dataType, chartPalette, monthTotalAmount]);

  const dailyTrend = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0);
    filteredMonthTx.forEach(t => { arr[new Date(t.date).getDate() - 1] += t.amount; });
    return arr.map((v, i) => ({ day: i + 1, value: v }));
  }, [filteredMonthTx, daysInMonth]);

  const monthlyItems = useMemo(() => {
    const items = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonth - i, y = currentYear;
      if (m < 0) { y--; m += 12; }
      const s = getMonthSummary(y, m);
      const v = dataType === 'expense' ? s.expense : s.income;
      items.push({ month: m + 1, year: y, value: v, label: (m + 1) + '月' });
    }
    return items;
  }, [transactions, dataType]);

  const topMonthTx = useMemo(() => {
    return [...filteredMonthTx].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [filteredMonthTx]);

  // =============== 周报数据 ===============
  const weekStart = useMemo(() => getMonday(new Date(), weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const weekTx = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d >= weekStart && d <= weekEnd && t.type === dataType;
    });
  }, [transactions, weekStart, weekEnd, dataType]);

  const weekSummaryTotal = useMemo(() => {
    const filtered = weekTx.filter(t => t.type === dataType);
    return filtered.reduce((s, t) => s + t.amount, 0);
  }, [weekTx, dataType]);

  const weekDailyData = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    weekTx.forEach(t => {
      const d = new Date(t.date);
      const dayOfWeek = d.getDay(); // 0=Sun
      const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon
      arr[idx] += t.amount;
    });
    return arr.map((v, i) => ({ day: i, label: WEEKDAY_LABELS[i], value: v }));
  }, [weekTx]);

  // 上周对照
  const lastWeekStart = useMemo(() => getMonday(new Date(), weekOffset - 1), [weekOffset]);
  const lastWeekEnd = useMemo(() => {
    const d = new Date(lastWeekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [lastWeekStart]);
  const lastWeekTotal = useMemo(() => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d >= lastWeekStart && d <= lastWeekEnd && t.type === dataType;
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, lastWeekStart, lastWeekEnd, dataType]);

  const weekDailyAvg = 7 > 0 ? weekSummaryTotal / 7 : 0;
  const weekDiffVsLast = weekSummaryTotal - lastWeekTotal;
  const weekBalance = useMemo(() => {
    const allWeekTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= weekStart && d <= weekEnd;
    });
    return calcBalance(allWeekTx);
  }, [transactions, weekStart, weekEnd]);

  const weekCategoryItems = useMemo(() => {
    const { byCategory } = calcSummary(
      transactions.filter(t => {
        const d = new Date(t.date);
        return d >= weekStart && d <= weekEnd;
      }),
      dataType,
    );
    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, amount: value,
        color: chartPalette[i % chartPalette.length],
        percent: weekSummaryTotal > 0 ? Math.round((value / weekSummaryTotal) * 100) : 0,
      }));
  }, [transactions, weekStart, weekEnd, dataType, chartPalette, weekSummaryTotal]);

  const topWeekTx = useMemo(() => {
    return [...weekTx].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [weekTx]);

  // =============== 年报数据 ===============
  const reportYear = currentYear + yearOffset;
  const canGoPrevYear = true;
  const canGoNextYear = reportYear < currentYear;

  const yearTx = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === reportYear && t.type === dataType;
    });
  }, [transactions, reportYear, dataType]);

  const yearSummaryTotal = useMemo(() => {
    return yearTx.reduce((s, t) => s + t.amount, 0);
  }, [yearTx]);

  // 去年对照
  const lastYearTotal = useMemo(() => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === reportYear - 1 && t.type === dataType;
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, reportYear, dataType]);

  const yearMonthlyAvg = 12 > 0 ? yearSummaryTotal / 12 : 0;
  const yearDiffVsLast = yearSummaryTotal - lastYearTotal;
  const yearBalance = useMemo(() => {
    const allYearTx = transactions.filter(t => new Date(t.date).getFullYear() === reportYear);
    return calcBalance(allYearTx);
  }, [transactions, reportYear]);

  const yearCategoryItems = useMemo(() => {
    const { byCategory } = calcSummary(
      transactions.filter(t => new Date(t.date).getFullYear() === reportYear),
      dataType,
    );
    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, amount: value,
        color: chartPalette[i % chartPalette.length],
        percent: yearSummaryTotal > 0 ? Math.round((value / yearSummaryTotal) * 100) : 0,
      }));
  }, [transactions, reportYear, dataType, chartPalette, yearSummaryTotal]);

  const yearMonthlyItems = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => {
      const monthTx = yearTx.filter(t => new Date(t.date).getMonth() === idx);
      const value = monthTx.reduce((s, t) => s + t.amount, 0);
      return { month: idx + 1, year: reportYear, value, label };
    });
  }, [yearTx, reportYear]);

  // 多年度对比（最近 5 年 + 本年）
  const multiYearItems = useMemo(() => {
    const items = [];
    for (let i = 5; i >= 0; i--) {
      const y = currentYear - i;
      const yrTx = transactions.filter(t => new Date(t.date).getFullYear() === y && t.type === dataType);
      const value = yrTx.reduce((s, t) => s + t.amount, 0);
      items.push({ year: y, value, label: String(y) });
    }
    return items;
  }, [transactions, dataType]);

  const topYearTx = useMemo(() => {
    return [...yearTx].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [yearTx]);

  // =============== 渲染判断 ===============
  const hasData = period === 'month'
    ? monthTotalAmount > 0
    : period === 'week'
    ? weekSummaryTotal > 0
    : yearSummaryTotal > 0;

  const totalLabel = dataType === 'expense' ? '支出' : '收入';

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: tc.text }]}>统计</Text>
          </View>
          {/* 分享按钮 */}
          {period !== 'week' ? (
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: tc.primary }]}
              onPress={async () => {
                try {
                  if (period === 'month') {
                    await shareMonthlyReport(
                      transactions, selectedYear, selectedMonth,
                      settings, tc.categories,
                    );
                  } else {
                    await shareYearlyReport(
                      transactions, reportYear,
                      settings, tc.categories,
                    );
                  }
                } catch (e) {
                  Alert.alert('分享失败', e?.message || '请稍后重试');
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={16} color={tc.primaryOn} />
              <Text style={[styles.shareBtnText, { color: tc.primaryOn }]}>分享</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── 档期选择器 ── */}
        <View style={styles.periodRow}>
          {['week', 'month', 'year'].map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodTab,
                period === p && [styles.periodTabActive, { backgroundColor: tc.primary }],
              ]}
              onPress={() => switchPeriod(p)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.periodTabText,
                { color: period === p ? tc.primaryOn : tc.textMuted },
                period === p && styles.periodTabTextActive,
              ]}>
                {p === 'week' ? '周报' : p === 'month' ? '月报' : '年报'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 导航 + 收支切换 ── */}
        <View style={styles.controlsRow}>
          {period === 'month' ? (
            <>
              <TouchableOpacity onPress={goPrevMonth} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={tc.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.navText, { color: tc.text }]}>
                {selectedYear}.{String(selectedMonth + 1).padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={goNextMonth} disabled={!canGoNext} hitSlop={8}>
                <Ionicons name="chevron-forward" size={18} color={canGoNext ? tc.textMuted : tc.divider} />
              </TouchableOpacity>
            </>
          ) : period === 'week' ? (
            <>
              <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={tc.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.navText, { color: tc.text }]}>{getWeekLabel(weekStart)}</Text>
              <TouchableOpacity
                onPress={() => setWeekOffset(w => w + 1)}
                disabled={isSameWeek(new Date(), weekStart)}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isSameWeek(new Date(), weekStart) ? tc.divider : tc.textMuted}
                />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setYearOffset(y => y - 1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={tc.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.navText, { color: tc.text }]}>{reportYear}年</Text>
              <TouchableOpacity
                onPress={() => setYearOffset(y => y + 1)}
                disabled={reportYear >= currentYear}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={reportYear >= currentYear ? tc.divider : tc.textMuted}
                />
              </TouchableOpacity>
            </>
          )}

          <View style={[styles.segment, { backgroundColor: tc.surfaceMuted }]}>
            <TouchableOpacity
              style={[styles.segmentItem, dataType === 'expense' && styles.segmentItemActive]}
              onPress={() => { setDataType('expense'); setSelectedDay(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: dataType === 'expense' ? tc.text : tc.textMuted }]}>支出</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, dataType === 'income' && styles.segmentItemActive]}
              onPress={() => { setDataType('income'); setSelectedDay(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: dataType === 'income' ? tc.text : tc.textMuted }]}>收入</Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasData ? (
          <>
            {/* ── AI 月度复盘（仅月报显示） ── */}
            {period === 'month' ? (
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
                  <Text style={[styles.aiSubtitle, { color: tc.textMuted }]}>AI 读取本月账目，生成中文复盘报告</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tc.accent} />
              </TouchableOpacity>
            ) : null}

            {/* ── 4 格汇总 ── */}
            {period === 'month' ? (
              <MonthSummaryGrid
                tc={tc}
                selectedMonth={selectedMonth}
                dataType={dataType}
                totalAmount={monthTotalAmount}
                dailyAvg={monthDailyAvg}
                diffVsLast={monthDiffVsLast}
                balance={monthSummary.balance}
              />
            ) : period === 'week' ? (
              <WeekSummaryGrid
                tc={tc}
                dataType={dataType}
                totalAmount={weekSummaryTotal}
                dailyAvg={weekDailyAvg}
                diffVsLast={weekDiffVsLast}
                balance={weekBalance}
              />
            ) : (
              <YearSummaryGrid
                tc={tc}
                dataType={dataType}
                reportYear={reportYear}
                totalAmount={yearSummaryTotal}
                monthlyAvg={yearMonthlyAvg}
                diffVsLast={yearDiffVsLast}
                balance={yearBalance}
              />
            )}

            {/* ── 趋势图 ── */}
            {period === 'month' ? (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    {selectedMonth + 1}月{totalLabel}趋势
                  </Text>
                  <Text style={[styles.cardUnit, { color: tc.textSubtle }]}>元</Text>
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
                  <Text style={[styles.dayHintText, { color: tc.textSubtle, marginBottom: 4 }]}>点击折线查看单日数据</Text>
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
            ) : period === 'week' ? (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    本周{totalLabel}（每日）
                  </Text>
                  <Text style={[styles.cardUnit, { color: tc.textSubtle }]}>元</Text>
                </View>
                <WeekBarChart data={weekDailyData} accent={tc.primary} muted={tc.textMuted} />
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    {reportYear}年{totalLabel}（月度）
                  </Text>
                  <Text style={[styles.cardUnit, { color: tc.textSubtle }]}>元</Text>
                </View>
                <YearMonthBarChart
                  items={yearMonthlyItems}
                  accent={tc.primary}
                  muted={tc.textMuted}
                  textMuted={tc.textMuted}
                  text={tc.text}
                  divider={tc.divider}
                />
              </View>
            )}

            {/* ── 分类构成 ── */}
            <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: tc.text }]}>
                  {period === 'week' ? '本周' : period === 'month' ? `${selectedMonth + 1}月` : `${reportYear}年`}
                  {totalLabel}分类构成
                </Text>
              </View>
              <View style={styles.pieRow}>
                <PieRing
                  data={(period === 'week' ? weekCategoryItems : period === 'month' ? monthCategoryItems : yearCategoryItems).map(it => ({ value: it.amount, color: it.color }))}
                  size={150}
                  thickness={26}
                  center={(
                    <View style={styles.pieCenter}>
                      <Text style={[styles.pieCenterLabel, { color: tc.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                        {period === 'week' ? '本周' : period === 'month' ? '本月' : '本年'}{totalLabel}
                      </Text>
                      <Text style={[styles.pieCenterAmount, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {formatMoney(period === 'week' ? weekSummaryTotal : period === 'month' ? monthTotalAmount : yearSummaryTotal, settings.currency).replace('¥', '')}
                      </Text>
                    </View>
                  )}
                />
              </View>
              <View style={styles.rankList}>
                {(period === 'week' ? weekCategoryItems : period === 'month' ? monthCategoryItems : yearCategoryItems).slice(0, 3).map((item, idx) => (
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

            {/* ── 对比柱状图 ── */}
            {period === 'month' ? (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>月支出对比</Text>
                </View>
                <BarChartRow
                  items={monthlyItems}
                  accent={tc.primary}
                  muted={tc.textSubtle}
                  divider={tc.divider}
                  textMuted={tc.textMuted}
                  text={tc.text}
                  selectedKey={selectedYear + '_' + (selectedMonth + 1)}
                  onSelect={(d) => { setSelectedYear(d.year); setSelectedMonth(d.month - 1); setSelectedDay(null); }}
                />
              </View>
            ) : period === 'year' ? (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>年度{totalLabel}对比</Text>
                </View>
                <BarChartRow
                  items={multiYearItems}
                  accent={tc.primary}
                  muted={tc.textSubtle}
                  divider={tc.divider}
                  textMuted={tc.textMuted}
                  text={tc.text}
                  selectedKey={String(reportYear)}
                  onSelect={(d) => {
                    setYearOffset(d.year - currentYear);
                  }}
                />
              </View>
            ) : null}

            {/* ── 排行 ── */}
            {(period === 'week' ? topWeekTx : period === 'month' ? topMonthTx : topYearTx).length > 0 && (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    {period === 'week'
                      ? getWeekLabel(weekStart)
                      : period === 'month'
                      ? `${selectedYear}年${selectedMonth + 1}月`
                      : `${reportYear}年`}
                    {totalLabel}排行
                  </Text>
                </View>
                <View>
                  {(period === 'week' ? topWeekTx : period === 'month' ? topMonthTx : topYearTx).map((tx, i, arr) => {
                    const item = (period === 'week' ? weekCategoryItems : period === 'month' ? monthCategoryItems : yearCategoryItems).find(c => c.name === tx.category);
                    return (
                      <View key={tx.id} style={[styles.txRow, i < arr.length - 1 && { borderBottomColor: tc.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                        <View style={[styles.colorDot, { backgroundColor: item?.color || tc.textSubtle }]} />
                        <View style={styles.txInfo}>
                          <Text style={[styles.txCategory, { color: tc.text }]} numberOfLines={1}>{tx.category}</Text>
                          <Text style={[styles.txNote, { color: tc.textMuted }]} numberOfLines={1}>
                            {new Date(tx.date).toLocaleDateString('zh-CN')}{tx.note ? ` · ${tx.note}` : ''}
                          </Text>
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
              title="暂无数据"
              subtitle={
                period === 'week' ? '本周还没有记录，快去记一笔吧'
                : period === 'month' ? '本月还没有记录，快去记一笔吧'
                : '本年还没有记录，快去记一笔吧'
              }
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
//  子组件 - 汇总卡片
// ============================================================
function SummaryCell({ tc, label, amount, amountColor }) {
  return (
    <View style={[styles.summaryCell, { backgroundColor: tc.surface, borderColor: tc.border, ...shadows.sm }]}>
      <Text style={[styles.summaryLabel, { color: tc.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryAmount, { color: amountColor || tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
    </View>
  );
}

function MonthSummaryGrid({ tc, selectedMonth, dataType, totalAmount, dailyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell tc={tc} label={`${selectedMonth + 1}月${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)} />
      <SummaryCell tc={tc} label={`日均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)} />
      <SummaryCell tc={tc} label={`比上月${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? tc.danger : tc.success} />
      <SummaryCell tc={tc} label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? tc.success : tc.danger} />
    </View>
  );
}

function WeekSummaryGrid({ tc, dataType, totalAmount, dailyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell tc={tc} label={`本周${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)} />
      <SummaryCell tc={tc} label={`日均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? dailyAvg.toFixed(2) : dailyAvg.toFixed(0)} />
      <SummaryCell tc={tc} label={`比上周${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? tc.danger : tc.success} />
      <SummaryCell tc={tc} label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? tc.success : tc.danger} />
    </View>
  );
}

function YearSummaryGrid({ tc, dataType, reportYear, totalAmount, monthlyAvg, diffVsLast, balance }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryCell tc={tc} label={`${reportYear}年${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? totalAmount.toFixed(2) : totalAmount.toFixed(0)} />
      <SummaryCell tc={tc} label={`月均${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={dataType === 'expense' ? monthlyAvg.toFixed(2) : monthlyAvg.toFixed(0)} />
      <SummaryCell tc={tc} label={`比去年${dataType === 'expense' ? '支出' : '收入'}(元)`}
        amount={`${diffVsLast >= 0 ? '+' : ''}${diffVsLast.toFixed(2)}`}
        amountColor={diffVsLast > 0 ? tc.danger : tc.success} />
      <SummaryCell tc={tc} label="收支结余(元)"
        amount={balance.toFixed(2)}
        amountColor={balance >= 0 ? tc.success : tc.danger} />
    </View>
  );
}

// ============================================================
//  子组件 - 周内每日柱状图
// ============================================================
function WeekBarChart({ data, accent, muted }) {
  const width = screenWidth - spacing.base * 4;
  const height = 140;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const barWidth = (width - data.length * 6) / data.length;
  const labelY = height - 24;

  return (
    <View style={{ width, height, alignItems: 'center' }}>
      <Svg width={width} height={labelY}>
        {data.map((d, i) => {
          const barH = max > 0 ? (d.value / max) * (labelY - 12) : 4;
          const x = i * (barWidth + 6);
          const y = labelY - 8 - barH;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx={3}
                ry={3}
                fill={d.value > 0 ? WEEKDAY_COLORS[i % 7] : accent}
                opacity={d.value > 0 ? 0.85 : 0.2}
              />
            </G>
          );
        })}
      </Svg>
      {/* 标签渲染在 SVG 外部 */}
      <View style={styles.weekBarLabels}>
        {data.map((d, i) => (
          <View key={i} style={{ width: barWidth, alignItems: 'center', marginHorizontal: 3 }}>
            {d.value > 0 ? (
              <Text style={[styles.weekBarValue, { color: muted }]}>
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : Math.round(d.value)}
              </Text>
            ) : null}
            <Text style={[styles.weekBarLabel, { color: muted }]}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================================
//  子组件 - 年度月度柱状图
// ============================================================
function YearMonthBarChart({ items, accent, muted, textMuted, text, divider }) {
  const values = items.map(i => i.value);
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barChartRow}>
      {items.map((d, i) => {
        const heightPct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <View key={i} style={styles.barCol}>
            <Text style={[styles.barValue, { color: textMuted }]}>
              {d.value > 0 ? (d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : Math.round(d.value)) : ''}
            </Text>
            {d.value > 0 ? (
              <View
                style={[styles.bar, { height: Math.max(heightPct * 0.8, 8), backgroundColor: accent, opacity: 0.6, borderRadius: 3 }]}
              />
            ) : (
              <View style={[styles.barEmpty, { backgroundColor: divider || '#ddd' }]} />
            )}
            <Text style={[styles.barLabel, { color: textMuted }]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
//  折线图组件（原有，不变）
// ============================================================
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

  let maxIdx = 0;
  values.forEach((v, i) => { if (v > values[maxIdx]) maxIdx = i; });

  const polylinePoints = points.map(p => p.x + ',' + p.y).join(' ');

  const labels = [];
  if (data.length > 0) {
    labels.push({ x: padding.left, label: '1' });
    if (data.length > 2) labels.push({ x: padding.left + innerW / 2, label: String(Math.round(data.length / 2)) });
    labels.push({ x: padding.left + innerW, label: String(data.length) });
  }

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
            <Line key={'g' + i} x1={padding.left} y1={padding.top + innerH * p} x2={padding.left + innerW} y2={padding.top + innerH * p} stroke={divider} strokeWidth={1} strokeDasharray="2,4" />
          ))}
          <Polyline points={polylinePoints} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (values[i] > 0 ? <Circle key={'p' + i} cx={p.x} cy={p.y} r={2.5} fill={accent} /> : null))}
          {values[maxIdx] > 0 && <Circle cx={points[maxIdx].x} cy={points[maxIdx].y} r={4} fill={accent} />}
          {selPoint && values[selIdx] > 0 && (
            <G>
              <Line x1={selPoint.x} y1={padding.top} x2={selPoint.x} y2={padding.top + innerH} stroke={accent} strokeWidth={1} strokeDasharray="2,3" opacity={0.5} />
              <Circle cx={selPoint.x} cy={selPoint.y} r={5} fill={accent} stroke="#FFFFFF" strokeWidth={2} />
            </G>
          )}
        </Svg>
      </View>
      <View style={styles.lineLabels}>
        {labels.map((l, i) => <Text key={i} style={[styles.lineLabel, { color: muted }]}>{l.label}</Text>)}
      </View>
    </View>
  );
}

// ============================================================
//  柱状图行（原有，不变）
// ============================================================
function BarChartRow({ items, accent, muted, divider, textMuted, text, selectedKey, onSelect }) {
  const values = items.map(i => i.value);
  const max = Math.max(...values, 1);
  return (
    <View style={styles.barChartRow}>
      {items.map((d, i) => {
        const key = d.year + '_' + (d.month || '');
        const isSelected = selectedKey === key;
        const heightPct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <TouchableOpacity key={key} activeOpacity={0.7} style={styles.barCol} onPress={() => onSelect && onSelect(d)}>
            <Text style={[styles.barValue, { color: isSelected ? text : textMuted }]}>
              {d.value > 0 ? (d.value >= 1000 ? (Math.round(d.value / 100) / 10 + 'k') : Math.round(d.value)) : ''}
            </Text>
            {d.value > 0 ? (
              <View style={[styles.bar, { height: Math.max(heightPct * 0.8, 8), backgroundColor: accent, opacity: isSelected ? 1 : 0.35, borderRadius: isSelected ? 4 : 3 }]} />
            ) : (
              <View style={[styles.barEmpty, { backgroundColor: divider }]} />
            )}
            <Text style={[styles.barLabel, { color: isSelected ? text : muted, fontWeight: isSelected ? '600' : '400' }]}>{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ============================================================
//  Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingBottom: spacing.xl },

  headerRow: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.6, marginTop: 2 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  shareBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // 档期选择器
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
    gap: 0,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  periodTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  periodTabText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.2,
  },
  periodTabTextActive: {
    fontWeight: fontWeight.semibold,
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  navText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2, paddingHorizontal: spacing.sm },

  segment: { flexDirection: 'row', borderRadius: borderRadius.full, padding: 3 },
  segmentItem: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: borderRadius.full },
  segmentItemActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: -0.2 },

  // AI 卡片
  aiCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.base, marginBottom: spacing.base,
    padding: spacing.base, borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md,
  },
  aiIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  aiTextWrap: { flex: 1 },
  aiTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  aiSubtitle: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },

  // 汇总格
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm },
  summaryCell: { width: (screenWidth - spacing.base * 2 - spacing.sm) / 2, padding: spacing.base, borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  summaryAmount: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginTop: spacing.xs, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },

  // 通用卡片
  card: { marginHorizontal: spacing.base, marginBottom: spacing.base, padding: spacing.base, borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  cardUnit: { fontSize: fontSize.xs },

  // 折线图
  lineLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginTop: 2 },
  lineLabel: { fontSize: fontSize.xs, fontVariant: ['tabular-nums'] },
  dayHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginBottom: 4 },
  dayHintText: { fontSize: fontSize.xs, letterSpacing: -0.1, fontVariant: ['tabular-nums'] },

  // Pie
  pieRow: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm, position: 'relative' },
  pieCenter: { position: 'absolute', alignItems: 'center' },
  pieCenterLabel: { fontSize: fontSize.xs },
  pieCenterAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2, fontVariant: ['tabular-nums'] },

  // 排行
  rankList: { marginTop: spacing.base },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  rankIndex: { fontSize: fontSize.md, width: 16, fontWeight: fontWeight.medium },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  rankName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, flex: 0, width: 60, letterSpacing: -0.2 },
  rankPercent: { fontSize: fontSize.xs, width: 35, textAlign: 'right' },
  rankAmount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },

  // 柱状图
  barChartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 140, paddingTop: spacing.md },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '60%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barEmpty: { width: '60%', height: 2, borderRadius: 1, opacity: 0.3 },
  barValue: { fontSize: 9, fontWeight: fontWeight.semibold, marginBottom: 4, fontVariant: ['tabular-nums'], letterSpacing: -0.1 },
  barLabel: { fontSize: 10, marginTop: 4, fontVariant: ['tabular-nums'] },

  // 交易排行
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  txInfo: { flex: 1 },
  txCategory: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  txNote: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },
  txAmount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },

  // 周报柱状图标签
  weekBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 4,
  },
  weekBarValue: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  weekBarLabel: {
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },
});

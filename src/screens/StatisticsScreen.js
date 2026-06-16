// 璐璐记账 · 统计（周报 / 月报 / 年报）
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { EmptyState } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
} from '../theme';
import ViewShot from 'react-native-view-shot';
import PieRing from '../components/PieRing';
import ShareCard from '../components/ShareCard';
import { shareCard } from '../utils/shareReport';
import LineChartView from '../components/charts/LineChartView';
import BarChartRow from '../components/charts/BarChartRow';
import { MOOD_LABELS, MOOD_EMOJIS } from '../utils/aiMoodShared';
import { analyzeMood, getCachedMoodAnalysis } from '../utils/aiMood';
import {
  MonthSummaryGrid,
  WeekSummaryGrid,
  YearSummaryGrid,
} from '../components/charts/SummaryGrids';

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




// ============================================================
//  主组件
// ============================================================
export default function StatisticsScreen({ navigation }) {
  const { transactions, settings, getMonthSummary } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  // ── 档期选择 ──
  const [period, setPeriod] = useState('week'); // 'week' | 'month' | 'year'
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

  // 缓存当周所有交易，避免多个 useMemo 重复过滤
  const weekAllTx = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d >= weekStart && d <= weekEnd;
    });
  }, [transactions, weekStart, weekEnd]);

  const weekTx = useMemo(() => {
    return weekAllTx.filter(t => t.type === dataType);
  }, [weekAllTx, dataType]);

  const weekSummaryTotal = useMemo(() => {
    return weekTx.reduce((s, t) => s + t.amount, 0);
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
    return calcBalance(weekAllTx);
  }, [weekAllTx]);

  const weekCategoryItems = useMemo(() => {
    const { byCategory } = calcSummary(weekAllTx, dataType);
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

  // 缓存年内所有交易，避免多个 useMemo 重复过滤
  const yearAllTx = useMemo(() => {
    return transactions.filter(t => new Date(t.date).getFullYear() === reportYear);
  }, [transactions, reportYear]);

  // =============== 心情统计 & AI 分析 ===============

  // 当前周期内的心情分布（expense only）
  const moodStats = useMemo(() => {
    let txs = [];
    if (period === 'week') {
      txs = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= weekStart && d <= weekEnd && t.type === 'expense';
      });
    } else if (period === 'month') {
      txs = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && t.type === 'expense';
      });
    } else {
      txs = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === reportYear && t.type === 'expense';
      });
    }
    const counts = {};
    let total = 0;
    for (const t of txs) {
      const m = t.mood || '';
      counts[m] = (counts[m] || 0) + 1;
      total++;
    }
    const items = Object.entries(counts)
      .map(([key, count]) => ({
        key,
        label: MOOD_LABELS[key] || key,
        emoji: MOOD_EMOJIS[key] || '',
        count,
        pct: total > 0 ? ((count / total) * 100).toFixed(0) : '0',
      }))
      .sort((a, b) => b.count - a.count);
    return { items, total };
  }, [period, transactions, weekStart, weekEnd, selectedYear, selectedMonth, reportYear]);

  // 当前周期内带心情标记的支出交易（用于 AI 分析）
  const moodPeriodTx = useMemo(() => {
    return transactions.filter(t => {
      if (t.type !== 'expense' || !t.mood) return false;
      const d = new Date(t.date);
      if (period === 'week') return d >= weekStart && d <= weekEnd;
      if (period === 'month') return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      return d.getFullYear() === reportYear;
    });
  }, [transactions, period, weekStart, weekEnd, selectedYear, selectedMonth, reportYear]);

  const moodTopExpenses = useMemo(() => {
    return [...moodPeriodTx].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [moodPeriodTx]);

  const periodLabel = period === 'week'
    ? getWeekLabel(weekStart)
    : period === 'month'
    ? `${selectedYear}年${selectedMonth + 1}月`
    : `${reportYear}年`;

  const [moodAnalysis, setMoodAnalysis] = useState(null);
  const [moodAnalysisLoading, setMoodAnalysisLoading] = useState(false);
  const [moodAnalysisError, setMoodAnalysisError] = useState('');

  const [rankingExpanded, setRankingExpanded] = useState(false);
  const [selectedPieIndex, setSelectedPieIndex] = useState(null);

  // 重置饼图选中状态（周期/数据变化时）
  useEffect(() => {
    setSelectedPieIndex(null);
  }, [categoryItems]);

  const moodPeriodTotal = period === 'week' ? weekSummaryTotal : period === 'month' ? monthTotalAmount : yearSummaryTotal;

  const handleRefreshMoodAnalysis = useCallback(async () => {
    if (moodAnalysisLoading) return;
    setMoodAnalysisLoading(true);
    setMoodAnalysisError('');
    setMoodAnalysis(null);
    const result = await analyzeMood({
      period, periodLabel,
      moodItems: moodStats.items,
      totalTransactions: moodStats.total,
      totalAmount: moodPeriodTotal,
      topExpenses: moodTopExpenses,
      currency: settings.currency,
      forceRegenerate: true,
    });
    setMoodAnalysisLoading(false);
    if (result.ok) {
      setMoodAnalysis(result.content);
    } else {
      setMoodAnalysisError(result.error);
    }
  }, [period, periodLabel, moodStats, moodPeriodTotal, moodTopExpenses, settings.currency, moodAnalysisLoading]);

  // 周期切换时自动加载心情分析。优先从缓存读取（无 loading 闪），缓存未命中才调 AI。
  // 不依赖 moodStats 对象引用，避免交易变动时重复触发。
  useEffect(() => {
    if (moodStats.items.length === 0 || moodStats.total === 0) {
      setMoodAnalysis(null);
      setMoodAnalysisLoading(false);
      setMoodAnalysisError('');
      return;
    }
    let alive = true;
    (async () => {
      // 先查缓存，有就直接展示
      const cached = await getCachedMoodAnalysis(period, periodLabel);
      if (!alive) return;
      if (cached?.content) {
        setMoodAnalysis(cached.content);
        setMoodAnalysisError('');
        setMoodAnalysisLoading(false);
        return;
      }
      // 无缓存 → 调 AI
      setMoodAnalysisLoading(true);
      setMoodAnalysisError('');
      setMoodAnalysis(null);
      const result = await analyzeMood({
        period, periodLabel,
        moodItems: moodStats.items,
        totalTransactions: moodStats.total,
        totalAmount: moodPeriodTotal,
        topExpenses: moodTopExpenses,
        currency: settings.currency,
      });
      if (!alive) return;
      setMoodAnalysisLoading(false);
      if (result.ok) {
        setMoodAnalysis(result.content);
      } else {
        setMoodAnalysisError(result.error);
      }
    })();
    return () => { alive = false; };
  }, [period, periodLabel]);

  const yearTx = useMemo(() => {
    return yearAllTx.filter(t => t.type === dataType);
  }, [yearAllTx, dataType]);

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
    return calcBalance(yearAllTx);
  }, [yearAllTx]);

  const yearCategoryItems = useMemo(() => {
    const { byCategory } = calcSummary(yearAllTx, dataType);
    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, amount: value,
        color: chartPalette[i % chartPalette.length],
        percent: yearSummaryTotal > 0 ? Math.round((value / yearSummaryTotal) * 100) : 0,
      }));
  }, [yearAllTx, dataType, chartPalette, yearSummaryTotal]);

  const topYearTx = useMemo(() => {
    return [...yearTx].sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [yearTx]);

  // =============== 渲染判断 ===============
  // 注: 原文件 L338 的 categoryItems 派生行移到这里,
  // 是为了消除 year 路径下的 TDZ/var-undefined 错误。
  // 真实根因: categoryItems 在 yearCategoryItems 之前声明并读取,
  // 切到 period === 'year' 时该标识符尚未初始化, 下游 L715 的
  // categoryItems.map(...) 会抛 Cannot read property 'map' of undefined。
  // 将 categoryItems 移到 yearCategoryItems 之后即消除问题。
  const categoryItems = period === 'week' ? weekCategoryItems : period === 'month' ? monthCategoryItems : yearCategoryItems;


  const hasData = period === 'month'
    ? monthTotalAmount > 0
    : period === 'week'
    ? weekSummaryTotal > 0
    : yearSummaryTotal > 0;

  const totalLabel = dataType === 'expense' ? '支出' : '收入';

  // ── ViewShot ref for sharing ──
  const cardRef = useRef(null);

  // ── Share card data ──
  const shareCardData = useMemo(() => {
    if (period === 'week') {
      return {
        period: 'week',
        weekLabel: getWeekLabel(weekStart),
        totalIncome: weekAllTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        totalExpense: weekAllTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        balance: weekBalance,
        topCategories: weekCategoryItems,
      };
    }
    if (period === 'month') {
      return {
        period: 'month',
        year: selectedYear,
        month: selectedMonth,
        totalIncome: monthSummary.income,
        totalExpense: monthSummary.expense,
        balance: monthSummary.balance,
        topCategories: monthCategoryItems,
      };
    }
    return {
      period: 'year',
      year: reportYear,
      totalIncome: yearAllTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: yearAllTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      balance: yearBalance,
      topCategories: yearCategoryItems,
    };
  }, [period, transactions, weekStart, weekEnd, weekTx, weekSummaryTotal, weekBalance, weekCategoryItems,
    selectedYear, selectedMonth, monthSummary, monthCategoryItems, reportYear, yearSummaryTotal, yearBalance, yearCategoryItems]);

  const handleShare = async () => {
    try {
      const dialogTitle = period === 'week'
        ? '分享周报'
        : period === 'month'
        ? `分享${selectedMonth + 1}月月报`
        : `分享${reportYear}年年报`;
      await shareCard(cardRef, dialogTitle);
    } catch (e) {
      Alert.alert('分享失败', e?.message || '请稍后重试');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
      >
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
              style={[styles.segmentItem, dataType === 'expense' && [styles.segmentItemActive, { backgroundColor: tc.surface }]]}
              onPress={() => { setDataType('expense'); setSelectedDay(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: dataType === 'expense' ? tc.text : tc.textMuted }]}>支出</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, dataType === 'income' && [styles.segmentItemActive, { backgroundColor: tc.surface }]]}
              onPress={() => { setDataType('income'); setSelectedDay(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, { color: dataType === 'income' ? tc.text : tc.textMuted }]}>收入</Text>
            </TouchableOpacity>
          </View>

          {/* 分享按钮 — 集成在导航行右侧 */}
          <TouchableOpacity
            style={[styles.shareIconBtn, { backgroundColor: tc.surfaceMuted }]}
            onPress={handleShare}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={15} color={tc.textMuted} />
          </TouchableOpacity>
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
            ) : null}

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
                  data={categoryItems.map(it => ({ value: it.amount, color: it.color }))}
                  size={150}
                  thickness={26}
                  selectedIndex={selectedPieIndex}
                  onSegmentPress={(idx) => setSelectedPieIndex(prev => prev === idx ? null : idx)}
                  center={(
                    <View style={styles.pieCenter}>
                      {selectedPieIndex !== null && categoryItems[selectedPieIndex] ? (
                        <>
                          <Text style={[styles.pieCenterLabel, { color: categoryItems[selectedPieIndex].color }]} numberOfLines={1} adjustsFontSizeToFit>
                            {categoryItems[selectedPieIndex].name}
                          </Text>
                          <Text style={[styles.pieCenterAmount, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatMoney(categoryItems[selectedPieIndex].amount, settings.currency).replace('¥', '')}
                          </Text>
                          <Text style={[styles.pieCenterPct, { color: tc.textMuted, fontSize: fontSize.sm, marginTop: 2 }]}>
                            {categoryItems[selectedPieIndex].percent}%
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.pieCenterLabel, { color: tc.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                            {period === 'week' ? '本周' : period === 'month' ? '本月' : '本年'}{totalLabel}
                          </Text>
                          <Text style={[styles.pieCenterAmount, { color: tc.text }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatMoney(period === 'week' ? weekSummaryTotal : period === 'month' ? monthTotalAmount : yearSummaryTotal, settings.currency).replace('¥', '')}
                          </Text>
                        </>
                      )}
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
            ) : null}

            {/* ── AI 心情分析 ── */}
            {moodStats.items.length > 0 && (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    <Ionicons name="sparkles" size={16} color={tc.accent} />  AI 心情分析
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.cardSubtitle, { color: tc.textMuted }]}>{moodStats.total}笔</Text>
                    <TouchableOpacity
                      onPress={handleRefreshMoodAnalysis}
                      disabled={moodAnalysisLoading}
                      hitSlop={8}
                    >
                      <Ionicons name="refresh" size={15} color={moodAnalysisLoading ? tc.textSubtle : tc.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {moodAnalysisLoading ? (
                  <Text style={[styles.cardSubtitle, { color: tc.textMuted }]}>AI 分析中…</Text>
                ) : moodAnalysis ? (
                  <Text style={{ color: tc.text, fontSize: fontSize.sm, lineHeight: 20, letterSpacing: -0.1 }}>
                    {moodAnalysis}
                  </Text>
                ) : moodAnalysisError === '未配置 AI' || moodAnalysisError === 'AI 未启用' ? (
                  <Text style={{ color: tc.textMuted, fontSize: fontSize.sm, lineHeight: 19 }}>
                    请到 设置 → AI 配置 中开启后获取心情分析
                  </Text>
                ) : moodAnalysisError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                    <Ionicons name="alert-circle-outline" size={14} color={tc.textMuted} />
                    <Text style={[styles.cardSubtitle, { color: tc.textMuted, flex: 1 }]}>{moodAnalysisError}</Text>
                  </View>
                ) : (
                  <Text style={[styles.cardSubtitle, { color: tc.textMuted }]}>点击刷新按钮生成分析</Text>
                )}
              </View>
            )}

            {/* ── 排行（默认折叠） ── */}
            {(period === 'week' ? topWeekTx : period === 'month' ? topMonthTx : topYearTx).length > 0 && (
              <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => setRankingExpanded(v => !v)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.cardTitle, { color: tc.text }]}>
                    {period === 'week'
                      ? getWeekLabel(weekStart)
                      : period === 'month'
                      ? `${selectedYear}年${selectedMonth + 1}月`
                      : `${reportYear}年`}
                    {totalLabel}排行
                  </Text>
                  <Ionicons
                    name={rankingExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={tc.textMuted}
                  />
                </TouchableOpacity>
                {rankingExpanded && (
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
                )}
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

      {/* 隐藏的报告卡片 — 供 ViewShot 截图分享用 */}
      {/* collapsable=false 防止 Android 优化掉屏幕外的 View */}
      <View style={{ position: 'absolute', left: -9999 }} collapsable={false}>
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.92 }}>
          <ShareCard
            period={period}
            year={shareCardData.year}
            month={shareCardData.month}
            weekLabel={shareCardData.weekLabel}
            totalIncome={shareCardData.totalIncome}
            totalExpense={shareCardData.totalExpense}
            balance={shareCardData.balance}
            topCategories={shareCardData.topCategories}
            dataType={dataType}
            currency={settings.currency}
          />
        </ViewShot>
      </View>
    </View>
  );
}

// 所有子组件已拆分到 src/components/charts/

// ============================================================
//  Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingBottom: spacing.xl },

  shareIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.sm,
  },

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
  segmentItemActive: {},
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: -0.2 },

  // AI 卡片
  aiCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.base, marginBottom: spacing.base,
    padding: spacing.base, borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, ...shadows.sm,
  },
  aiIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  aiTextWrap: { flex: 1 },
  aiTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  aiSubtitle: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },

  // 通用卡片
  card: { marginHorizontal: spacing.base, marginBottom: spacing.base, padding: spacing.base, borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, ...shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  cardUnit: { fontSize: fontSize.xs },

  dayHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginBottom: 4 },
  dayHintText: { fontSize: fontSize.xs, letterSpacing: -0.1, fontVariant: ['tabular-nums'] },

  // Pie
  pieRow: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm, position: 'relative' },
  pieCenter: { position: 'absolute', alignItems: 'center' },
  pieCenterLabel: { fontSize: fontSize.xs },
  pieCenterAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2, fontVariant: ['tabular-nums'] },

  cardSubtitle: { fontSize: fontSize.xs },

  // 排行
  rankList: { marginTop: spacing.base },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  rankIndex: { fontSize: fontSize.md, width: 16, fontWeight: fontWeight.medium },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  rankName: { fontSize: fontSize.md, fontWeight: fontWeight.medium, flex: 0, width: 60, letterSpacing: -0.2 },
  rankPercent: { fontSize: fontSize.xs, width: 35, textAlign: 'right' },
  rankAmount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },

  // 交易排行
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  txInfo: { flex: 1 },
  txCategory: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  txNote: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },
  txAmount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },
});

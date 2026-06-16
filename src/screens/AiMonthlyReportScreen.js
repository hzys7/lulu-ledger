// 小璐记账 · AI 月度复盘结果页
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { formatMoney } from '../utils/currency';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors, categories as categoryConfig } from '../theme';
import { generateMonthlyReport, clearCachedReport } from '../utils/aiReport';
import { loadAiConfig } from '../utils/aiConfig';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// 迷你 markdown 渲染：仅支持 ## 标题、- 列表、**粗体**、*斜体*、纯文本、emoji
// 不引入额外依赖
function renderInline(text, baseStyle) {
  // 先按 ** 拆分处理粗体，再处理 *
  const parts = [];
  let buf = '';
  let i = 0;
  const push = (txt, bold, italic) => {
    if (txt) parts.push({ txt, bold, italic });
  };
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      // 找到下一个 **
      const end = text.indexOf('**', i + 2);
      if (end > i) {
        push(buf, false, false);
        buf = '';
        const inner = text.substring(i + 2, end);
        push(inner, true, false);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i && text[end + 1] !== '*') {
        push(buf, false, false);
        buf = '';
        const inner = text.substring(i + 1, end);
        push(inner, false, true);
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  push(buf, false, false);
  return parts.map((p, idx) => (
    <Text key={idx} style={[
      baseStyle,
      p.bold && { fontWeight: fontWeight.bold },
      p.italic && { fontStyle: 'italic' },
    ]}>
      {p.txt}
    </Text>
  ));
}

function MarkdownView({ content, tc }) {
  const lines = content.split('\n');
  const blocks = [];
  let listBuf = [];
  function flushList() {
    if (listBuf.length > 0) {
      blocks.push({ type: 'list', items: listBuf });
      listBuf = [];
    }
  }
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.startsWith('## ')) {
      flushList();
      blocks.push({ type: 'h2', text: line.substring(3) });
    } else if (line.startsWith('# ')) {
      flushList();
      blocks.push({ type: 'h1', text: line.substring(2) });
    } else if (line.startsWith('- ')) {
      listBuf.push(line.substring(2));
    } else if (line.trim() === '') {
      flushList();
      blocks.push({ type: 'blank' });
    } else {
      flushList();
      blocks.push({ type: 'p', text: line });
    }
  }
  flushList();

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === 'h1') {
          return (
            <Text key={i} style={[styles.h1, { color: tc.text }]}>
              {renderInline(b.text, styles.h1)}
            </Text>
          );
        }
        if (b.type === 'h2') {
          return (
            <View key={i} style={styles.h2Row}>
              <View style={[styles.h2Bar, { backgroundColor: tc.primary }]} />
              <Text style={[styles.h2, { color: tc.text }]}>
                {renderInline(b.text, styles.h2)}
              </Text>
            </View>
          );
        }
        if (b.type === 'list') {
          return (
            <View key={i} style={styles.list}>
              {b.items.map((it, j) => (
                <View key={j} style={styles.listItem}>
                  <Text style={[styles.bullet, { color: tc.primary }]}>·</Text>
                  <Text style={[styles.listText, { color: tc.text }]}>
                    {renderInline(it, styles.listText)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        if (b.type === 'p') {
          return (
            <Text key={i} style={[styles.p, { color: tc.text }]}>
              {renderInline(b.text, styles.p)}
            </Text>
          );
        }
        return <View key={i} style={{ height: spacing.sm }} />;
      })}
    </View>
  );
}

export default function AiMonthlyReportScreen({ route, navigation }) {
  const { year, month } = route.params || {};
  const { transactions, settings, getMonthTransactions, getMonthSummary } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [txCount, setTxCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (year == null || month == null) {
      Alert.alert('错误', '未指定月份', [{ text: '好', onPress: () => navigation.goBack() }]);
      return;
    }
    (async () => {
      const cfg = await loadAiConfig();
      if (!mounted.current) return;
      setAiEnabled(!!cfg.enabled);
      setHasApiKey(!!cfg.apiKey);
    })();
  }, [year, month]);

  const handleGenerate = useCallback(async (force = false) => {
    if (loading) return;
    setLoading(true);
    setError('');
    const currentTxs = getMonthTransactions(year, month);
    const lastM = month === 0 ? 11 : month - 1;
    const lastY = month === 0 ? year - 1 : year;
    const lastTxs = getMonthTransactions(lastY, lastM);
    const summary = getMonthSummary(year, month);
    const lastSummary = {
      ...getMonthSummary(lastY, lastM),
      year: lastY,
      month: lastM,
    };
    const res = await generateMonthlyReport({
      year, month,
      currentTxs, lastTxs,
      summary, lastSummary,
      currency: settings.currency,
      forceRegenerate: force,
    });
    if (!mounted.current) return;
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setContent(res.content);
    setGeneratedAt(res.generatedAt);
    setIsCached(!!res.cached);
    setTxCount(currentTxs.length);
  }, [year, month, loading, getMonthTransactions, getMonthSummary, settings.currency]);

  // 首次进入：若缓存命中直接显示；否则显示空状态
  useEffect(() => {
    if (year == null || month == null) return;
    (async () => {
      const { getCachedReport } = require('../utils/aiReport');
      const cached = await getCachedReport(year, month);
      if (!mounted.current) return;
      if (cached && cached.content) {
        setContent(cached.content);
        setGeneratedAt(cached.generatedAt);
        setIsCached(true);
        setTxCount(cached.txCount || 0);
      }
    })();
  }, [year, month]);

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function handleShare() {
    if (!content) return;
    Share.share({
      title: year + '年' + MONTH_NAMES[month] + '月度复盘',
      message: '【小璐记账 · ' + year + '年' + MONTH_NAMES[month] + '月度复盘】\n\n' + content,
    }).catch(() => {});
  }

  function handleClearAndRegenerate() {
    Alert.alert(
      '重新生成',
      '将清除本月缓存并重新调用 AI 生成，确定吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重新生成',
          onPress: async () => {
            await clearCachedReport(year, month);
            setContent('');
            setGeneratedAt(null);
            setIsCached(false);
            handleGenerate(true);
          },
        },
      ],
    );
  }

  const monthLabel = year + '年' + MONTH_NAMES[month];

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 顶栏 */}
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: tc.divider, backgroundColor: tc.background }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={tc.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.topTitle, { color: tc.text }]}>AI 月度复盘</Text>
            <Text style={[styles.topSub, { color: tc.textMuted }]}>{monthLabel}</Text>
          </View>
          {content ? (
            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.backBtn}>
              <Ionicons name="share-outline" size={20} color={tc.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} />
          )}
        </View>

        {!aiEnabled || !hasApiKey ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={[styles.emptyTitle, { color: tc.text }]}>
              {!aiEnabled ? 'AI 功能未启用' : 'AI 功能未配置'}
            </Text>
            <Text style={[styles.emptyDesc, { color: tc.textMuted }]}>
              请前往设置 → AI 智能 → AI 配置，开启开关并填写 API Key。
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: tc.surfaceMuted }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={[styles.primaryBtnText, { color: tc.text }]}>我知道了</Text>
            </TouchableOpacity>
          </View>
        ) : !content ? (
          // 空状态：还没生成过
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{monthLabel}还没复盘</Text>
            <Text style={[styles.emptyDesc, { color: tc.textMuted }]}>
              点击下方按钮，让 AI 阅读你的{monthLabel}账目并生成中文复盘报告。
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: tc.primary }, loading && { opacity: 0.6 }]}
              onPress={() => handleGenerate(false)}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color={tc.primaryOn} />
                  <Text style={[styles.primaryBtnText, { color: tc.primaryOn }]}>AI 生成中…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={tc.primaryOn} />
                  <Text style={[styles.primaryBtnText, { color: tc.primaryOn, fontWeight: fontWeight.semibold }]}>开始复盘</Text>
                </>
              )}
            </TouchableOpacity>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger }]}>
                <Ionicons name="alert-circle" size={16} color={tc.danger} />
                <Text style={[styles.errorText, { color: tc.danger }]}>{error}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          // 复盘内容
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* 顶部元信息 */}
              <View style={[styles.metaRow, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <View style={styles.metaLeft}>
                  <Ionicons name="sparkles" size={14} color={tc.primary} />
                  <Text style={[styles.metaText, { color: tc.textSecondary }]}>
                    {isCached ? '已缓存 · ' : '本次生成 · '}
                    {formatTime(generatedAt)}
                    {' · ' + txCount + ' 笔账目'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClearAndRegenerate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={loading}>
                  <Text style={[styles.metaAction, { color: tc.primary }]}>{loading ? '生成中…' : '重新生成'}</Text>
                </TouchableOpacity>
              </View>
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: tc.dangerSubtle, borderColor: tc.danger, marginTop: spacing.md }]}>
                  <Ionicons name="alert-circle" size={16} color={tc.danger} />
                  <Text style={[styles.errorText, { color: tc.danger }]}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.markdownWrap}>
                <MarkdownView content={content} tc={tc} />
              </View>
              <View style={{ height: 100 }} />
            </ScrollView>
            {/* 底部操作栏 */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: tc.surface, borderTopColor: tc.divider }]}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: tc.surfaceMuted, borderColor: tc.border, borderWidth: StyleSheet.hairlineWidth }]}
                onPress={handleClearAndRegenerate}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Ionicons name="refresh" size={18} color={tc.text} />
                <Text style={[styles.actionBtnText, { color: tc.text }]}>重新生成</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: tc.primary }]}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Ionicons name="share-outline" size={18} color={tc.primaryOn} />
                <Text style={[styles.actionBtnText, { color: tc.primaryOn, fontWeight: fontWeight.semibold }]}>分享报告</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  topSub: { fontSize: fontSize.xs, marginTop: 2 },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  emptyDesc: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg },

  primaryBtn: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 200,
  },
  primaryBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  errorText: { fontSize: fontSize.sm, flex: 1, lineHeight: 19 },

  scrollContent: { padding: spacing.lg, paddingTop: spacing.md },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  metaText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  metaAction: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginLeft: spacing.sm },

  markdownWrap: { paddingBottom: spacing.md },

  h1: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, lineHeight: 34, marginBottom: spacing.md },
  h2Row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  h2Bar: { width: 4, height: 18, borderRadius: 2, marginRight: spacing.sm },
  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  list: { marginBottom: spacing.sm },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 2 },
  bullet: { fontSize: fontSize.md, lineHeight: 22, marginRight: 8, marginTop: 1, fontWeight: fontWeight.bold },
  listText: { fontSize: fontSize.md, lineHeight: 24, flex: 1 },
  p: { fontSize: fontSize.md, lineHeight: 24, marginBottom: spacing.sm },

  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtnPrimary: { flex: 1.4 },
  actionBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
});
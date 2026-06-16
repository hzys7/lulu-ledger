// 璐璐记账 - 交易详情弹窗（优雅版）
// 底部弹出式 Modal，展示一笔交易的全部信息
// 视觉：大金额区 + 详情卡片 + 选中标记 + 操作按钮

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  categories as categoryConfig,
} from '../theme';
import { formatMoney, getCurrencySymbol } from '../utils/currency';

// ─── 心情映射表 ─────────────────────────────────────────────
const MOOD_MAP = {
  '':          '未选择',
  'happy':     '快乐就完事了 🥳',
  'impulse':   '手一滑就买了 🫣',
  'regret':    '又踩坑了 💣',
  'necessary': '该花还是得花 🤷',
  'reward':    '辛苦钱犒劳自己 🍗',
  'painful':   '心在滴血 🩸',
  'satisfied': '真香！ ✨',
  'remorse':   '我为什么要买 🫠',
  'neutral':   '就那样吧 〰️',
  'worthit':   '值了 💯',
};

// ─── 工具函数 ───────────────────────────────────────────────

function withAlpha(hex, alpha) {
  if (!hex) return hex;
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

function getCategoryIcon(category, type) {
  const list = type === 'income' ? categoryConfig.income : categoryConfig.expense;
  const found = list.find((c) => c.name === category);
  return found ? found.icon : 'pricetag';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }) + ' ' + d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── 详情行组件 ─────────────────────────────────────────────

function DetailRow({ icon, label, children, tc, isLast }) {
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.divider },
      ]}
    >
      <View style={styles.detailLabel}>
        <Ionicons name={icon} size={15} color={tc.textSubtle} />
        <Text style={[styles.labelText, { color: tc.textMuted }]}>{label}</Text>
      </View>
      <View style={styles.detailValue}>
        {children}
      </View>
    </View>
  );
}

// ─── 主组件 ─────────────────────────────────────────────────

export default function TransactionDetailModal({
  visible,
  transaction,
  accounts = [],
  tc,
  onEdit,
  onDelete,
  onClose,
}) {
  const insets = useSafeAreaInsets();

  const accountName = useMemo(() => {
    if (!transaction?.accountId) return null;
    const acc = accounts.find((a) => a.id === transaction.accountId);
    return acc ? acc.name : null;
  }, [transaction, accounts]);

  const catIcon = useMemo(() => {
    if (!transaction) return 'pricetag';
    return getCategoryIcon(transaction.category, transaction.type);
  }, [transaction]);

  const catColor = useMemo(() => {
    if (!transaction) return tc.textSubtle;
    return tc.categories?.[transaction.category] || (transaction.type === 'income' ? tc.success : tc.textSubtle);
  }, [transaction, tc]);

  const currencySymbol = useMemo(() => {
    if (!transaction) return '';
    return getCurrencySymbol(transaction.currency || 'CNY');
  }, [transaction]);

  const isExpense = transaction?.type === 'expense';
  const amountPrefix = isExpense ? '-' : '+';
  const amountColor = isExpense ? tc.danger : tc.success;
  const moodText = transaction ? (MOOD_MAP[transaction.mood] || MOOD_MAP['']) : '';
  const bottomPadding = insets.bottom > 0 ? insets.bottom : spacing.lg;

  if (!transaction) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: tc.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: tc.surface,
              paddingBottom: bottomPadding,
            },
          ]}
          onPress={(e) => e.stopPropagation && e.stopPropagation()}
        >
          {/* ── 拖拽把手 ── */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: tc.border }]} />
          </View>

          {/* ── 选中标记 + 金额区域 ── */}
          <View style={styles.amountSection}>
            {/* 选中状态指示 */}
            <View style={styles.selectedBadge}>
              <View style={[styles.selectedCheck, { backgroundColor: tc.success }]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.selectedText, { color: tc.textMuted }]}>已选中</Text>
            </View>

            {/* 分类图标徽章 */}
            <View
              style={[
                styles.catBadge,
                { backgroundColor: withAlpha(catColor, 0.1) },
              ]}
            >
              <Ionicons name={catIcon} size={26} color={catColor} />
            </View>

            {/* 分类名称 */}
            <Text style={[styles.catName, { color: tc.textMuted }]}>
              {transaction.category}
            </Text>

            {/* 大金额 */}
            <Text style={[styles.amountText, { color: amountColor }]}>
              {amountPrefix}
              <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              {Math.abs(transaction.amount).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>

            {/* 心情标签（如果有） */}
            {transaction.mood ? (
              <View style={[styles.moodTag, { backgroundColor: tc.surfaceMuted }]}>
                <Text style={[styles.moodTagText, { color: tc.textMuted }]}>
                  {moodText}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── 详情卡片 ── */}
          <View style={[styles.detailCard, { backgroundColor: tc.surfaceMuted }]}>
            <DetailRow icon="calendar-outline" label="日期" tc={tc}>
              <Text style={[styles.valueText, { color: tc.text }]}>
                {formatDate(transaction.date)}
              </Text>
            </DetailRow>

            <DetailRow icon="document-text-outline" label="备注" tc={tc}>
              <Text
                style={[styles.valueText, { color: transaction.note ? tc.text : tc.textSubtle }]}
                numberOfLines={3}
              >
                {transaction.note || '无备注'}
              </Text>
            </DetailRow>

            <DetailRow icon="wallet-outline" label="账户" tc={tc}>
              <Text style={[styles.valueText, { color: accountName ? tc.text : tc.textSubtle }]}>
                {accountName || '未关联账户'}
              </Text>
            </DetailRow>

            <DetailRow icon="book-outline" label="账本" tc={tc} isLast>
              <Text style={[styles.valueText, { color: tc.text }]}>
                {transaction.bookName || '默认账本'}
              </Text>
            </DetailRow>
          </View>

          {/* ── 操作按钮 ── */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnEdit, { backgroundColor: tc.primary }]}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={17} color={tc.primaryOn} />
              <Text style={[styles.btnEditText, { color: tc.primaryOn }]}>编辑</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnDelete, { borderColor: tc.danger }]}
              onPress={onDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={17} color={tc.danger} />
              <Text style={[styles.btnDeleteText, { color: tc.danger }]}>删除</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── 样式表 ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },

  handleWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
  },

  // ── 选中标记 ──
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    marginBottom: spacing.md,
  },
  selectedCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  // ── 金额区域 ──
  amountSection: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  catBadge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  catName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    letterSpacing: -0.1,
  },
  amountText: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  currencySymbol: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
  },
  moodTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  moodTagText: {
    fontSize: fontSize.xs,
    letterSpacing: -0.1,
  },

  // ── 详情卡片 ──
  detailCard: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  labelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
    letterSpacing: -0.1,
  },
  detailValue: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: spacing.base,
  },
  valueText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    textAlign: 'right',
    letterSpacing: -0.1,
  },

  // ── 操作按钮 ──
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.sm,
  },
  btnEdit: {},
  btnDelete: {
    borderWidth: 1,
  },
  btnEditText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.xs,
    letterSpacing: -0.1,
  },
  btnDeleteText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.xs,
    letterSpacing: -0.1,
  },
});

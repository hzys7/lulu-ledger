// 小璐记账 · 净资产
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../context/FinanceContext';
import { EmptyState } from '../components/SharedComponents';
import { formatMoney } from '../utils/currency';
import { typeInfo } from '../utils/accountTypes';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
} from '../theme';

export default function NetWorthScreen() {
  const { accounts, addAccount, editAccount, removeAccount, adjustAccount, setDefaultAccount, settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null=新增, account=编辑
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('wechat');
  const [formBalance, setFormBalance] = useState('');

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');

  const totalNetWorth = useMemo(
    () => accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0),
    [accounts]
  );

  const openNew = useCallback(() => {
    setEditing(null);
    setFormName('');
    setFormType('wechat');
    setFormBalance('');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((acc) => {
    setEditing(acc);
    setFormName(acc.name);
    setFormType(acc.type);
    setFormBalance(String(acc.balance));
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const saveAccount = useCallback(async () => {
    const balance = parseFloat(formBalance) || 0;
    if (!formName.trim()) {
      Alert.alert('提示', '请输入账户名称');
      return;
    }
    if (editing) {
      await editAccount(editing.id, {
        name: formName.trim(),
        type: formType,
        balance,
      });
    } else {
      await addAccount({
        name: formName.trim(),
        type: formType,
        balance,
        isDefault: accounts.length === 0,
      });
    }
    closeModal();
  }, [editing, formName, formType, formBalance, accounts.length, addAccount, editAccount, closeModal]);

  const handleDelete = useCallback((acc) => {
    Alert.alert(
      '删除账户',
      `确定删除「${acc.name}」吗？相关历史交易不会被删除，但余额调整将无法回退。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => removeAccount(acc.id),
        },
      ]
    );
  }, [removeAccount]);

  const openAdjust = useCallback((acc) => {
    setAdjusting(acc);
    setAdjustDelta('');
    setAdjustModalOpen(true);
  }, []);

  const saveAdjust = useCallback(async () => {
    const delta = parseFloat(adjustDelta);
    if (isNaN(delta) || delta === 0) {
      Alert.alert('提示', '请输入非零调整金额');
      return;
    }
    if (adjusting) await adjustAccount(adjusting.id, delta);
    setAdjustModalOpen(false);
    setAdjusting(null);
  }, [adjustDelta, adjusting, adjustAccount]);

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 100 }}
      >
        {/* 顶部净资产大卡 */}
        <View style={[styles.heroCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          {/* 装饰性背景元素 */}
          <View style={[styles.heroDeco, { backgroundColor: totalNetWorth >= 0 ? tc.primary + '08' : tc.danger + '08' }]} />
          <Text style={[styles.heroLabel, { color: tc.textMuted }]}>净资产</Text>
          <Text style={[styles.heroAmount, { color: totalNetWorth >= 0 ? tc.text : tc.danger }]}>
            {formatMoney(totalNetWorth, settings.currency)}
          </Text>
          <Text style={[styles.heroSub, { color: tc.textSubtle }]}>
            {accounts.length} 个账户
          </Text>
        </View>

        {/* 账户列表 */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: tc.text }]}>我的账户</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: tc.surfaceMuted }]}
            onPress={openNew}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={tc.text} />
            <Text style={[styles.addBtnText, { color: tc.text }]}>新增</Text>
          </TouchableOpacity>
        </View>

        {accounts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="wallet-outline"
              title={'还没有账户'}
              subtitle={'点右上角"新增"创建你的第一个账户'}
            />
          </View>
        ) : (
          <View style={styles.accountsList}>
            {accounts.map((acc) => {
              const info = typeInfo(acc.type);
              return (
                <View
                  key={acc.id}
                  style={[styles.accountCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
                >
                  <View style={[styles.accountIcon, { backgroundColor: info.color + '22' }]}>
                    <Ionicons name={info.icon} size={22} color={info.color} />
                  </View>
                  <View style={styles.accountInfo}>
                    <View style={styles.accountNameRow}>
                      <Text style={[styles.accountName, { color: tc.text }]}>{acc.name}</Text>
                      {acc.isDefault ? (
                        <View style={[styles.defaultBadge, { backgroundColor: tc.primarySubtle }]}>
                          <Text style={[styles.defaultBadgeText, { color: tc.primary }]}>默认</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.accountType, { color: tc.textMuted }]}>{info.name}</Text>
                  </View>
                  <View style={styles.accountRight}>
                    <Text
                      style={[
                        styles.accountBalance,
                        { color: (Number(acc.balance) || 0) >= 0 ? tc.text : tc.danger },
                      ]}
                    >
                      {formatMoney(acc.balance, settings.currency)}
                    </Text>
                    <View style={styles.accountActions}>
                      <TouchableOpacity
                        onPress={() => openEdit(acc)}
                        style={[styles.cardActionBtn, { backgroundColor: tc.surfaceMuted }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="create-outline" size={12} color={tc.textMuted} />
                        <Text style={[styles.cardActionText, { color: tc.textMuted }]}>编辑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(acc)}
                        style={[styles.cardActionBtn, { backgroundColor: tc.surfaceMuted }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={12} color={tc.danger} />
                        <Text style={[styles.cardActionText, { color: tc.danger }]}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.tip, { color: tc.textSubtle }]}>
          记一笔支出/收入时，会自动从默认账户扣减或增加
        </Text>
      </ScrollView>

      {/* 新增/编辑账户弹窗 */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={[styles.modalSheet, { backgroundColor: tc.surface, borderColor: tc.border }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: tc.divider }]} />
            <Text style={[styles.modalTitle, { color: tc.text }]}>
              {editing ? '编辑账户' : '新增账户'}
            </Text>

            <Text style={[styles.fieldLabel, { color: tc.textMuted }]}>账户类型</Text>
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: formType === t.key ? t.color + '22' : tc.surfaceMuted,
                      borderColor: formType === t.key ? t.color : 'transparent',
                    },
                  ]}
                  onPress={() => setFormType(t.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={t.icon} size={16} color={formType === t.key ? t.color : tc.textMuted} />
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: formType === t.key ? t.color : tc.text },
                    ]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: tc.textMuted }]}>账户名称</Text>
            <TextInput
              style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
              value={formName}
              onChangeText={setFormName}
              placeholder="例如：日常微信、工资卡"
              placeholderTextColor={tc.textSubtle}
              maxLength={20}
            />

            <Text style={[styles.fieldLabel, { color: tc.textMuted }]}>当前余额</Text>
            <TextInput
              style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
              value={formBalance}
              onChangeText={setFormBalance}
              placeholder="0.00"
              placeholderTextColor={tc.textSubtle}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary }]}
              onPress={saveAccount}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>保存</Text>
            </TouchableOpacity>

            {editing ? (
              <View style={styles.editActionRow}>
                <TouchableOpacity
                  style={[styles.editActionBtn, { backgroundColor: tc.surfaceMuted }]}
                  onPress={() => { closeModal(); openAdjust(editing); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-vertical" size={15} color={tc.text} />
                  <Text style={[styles.editActionText, { color: tc.text }]}>调整余额</Text>
                </TouchableOpacity>
                {!editing.isDefault ? (
                  <TouchableOpacity
                    style={[styles.editActionBtn, { backgroundColor: tc.surfaceMuted }]}
                    onPress={() => { setDefaultAccount(editing.id); closeModal(); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="star-outline" size={15} color={tc.text} />
                    <Text style={[styles.editActionText, { color: tc.text }]}>设为默认</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 调账弹窗 */}
      <Modal
        visible={adjustModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAdjustModalOpen(false)}>
          <Pressable style={[styles.adjustSheet, { backgroundColor: tc.surface, borderColor: tc.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: tc.text, textAlign: 'center' }]}>调整余额</Text>
            <Text style={[styles.adjustHint, { color: tc.textMuted }]}>
              {adjusting ? `${adjusting.name} · 当前 ${formatMoney(adjusting.balance, settings.currency)}` : ''}
            </Text>
            <Text style={[styles.adjustHint, { color: tc.textSubtle, fontSize: fontSize.xs }]}>
              {'输入正数表示增加，负数表示减少（不通过交易流水）'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border, marginTop: spacing.md }]}
              value={adjustDelta}
              onChangeText={setAdjustDelta}
              placeholder="例如：-50 或 +200"
              placeholderTextColor={tc.textSubtle}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.adjustBtnRow}>
              <TouchableOpacity
                style={[styles.adjustBtn, { backgroundColor: tc.surfaceMuted }]}
                onPress={() => setAdjustModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: tc.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adjustBtn, { backgroundColor: tc.primary, marginLeft: spacing.sm }]}
                onPress={saveAdjust}
                activeOpacity={0.8}
              >
                <Text style={[styles.adjustBtnText, { color: tc.primaryOn }]}>确认</Text>
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
  heroCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    ...shadows.md,
  },
  heroLabel: { fontSize: fontSize.sm, letterSpacing: -0.1 },
  heroAmount: {
    fontSize: 44,
    fontWeight: fontWeight.bold,
    letterSpacing: -1.5,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  heroSub: { fontSize: fontSize.xs, marginTop: spacing.xs, letterSpacing: -0.1 },
  heroDeco: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -40,
    right: -30,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  listTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  addBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginLeft: 2 },

  emptyWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },

  accountsList: { paddingHorizontal: spacing.base, gap: spacing.sm },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.sm,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  accountInfo: { flex: 1 },
  accountNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  defaultBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  accountType: { fontSize: fontSize.xs, marginTop: 2, letterSpacing: -0.1 },
  accountRight: { alignItems: 'flex-end' },
  accountBalance: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  accountActions: { flexDirection: 'row', marginTop: 6, gap: 6 },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  cardActionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  tip: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.base,
    letterSpacing: -0.1,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  adjustSheet: {
    marginHorizontal: spacing.lg,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.md,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  typeChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginLeft: 2 },
  input: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    height: 40,
    fontSize: fontSize.md,
  },
  saveBtn: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  editActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: borderRadius.md,
  },
  editActionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  adjustHint: { fontSize: fontSize.sm, textAlign: 'center', marginBottom: 4 },
  adjustBtnRow: { flexDirection: 'row', marginTop: spacing.base },
  adjustBtn: { flex: 1, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  adjustBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});

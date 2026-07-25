// 小璐记账 · 转账弹窗
// 底部弹出式 Modal，在两个资金账户之间转移资金
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountIcon } from './AccountIcon';
import { typeInfo } from '../utils/accountTypes';
import { formatMoney } from '../utils/currency';
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
} from '../theme';

export default function TransferModal({
  visible,
  accounts,
  tc,
  currency,
  onTransfer,
  onClose,
}) {
  const [fromId, setFromId] = useState(accounts[0]?.id || '');
  const [toId, setToId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pickerTarget, setPickerTarget] = useState(null); // 'from' | 'to' | null

  const fromAccount = accounts.find(a => a.id === fromId);
  const toAccount = accounts.find(a => a.id === toId);

  const handleSwap = useCallback(() => {
    const tmpFrom = fromId;
    setFromId(toId);
    setToId(tmpFrom);
  }, [fromId, toId]);

  const handleConfirm = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (fromId === toId) return;
    await onTransfer({ fromAccountId: fromId, toAccountId: toId, amount: amt, note: note.trim() });
    // 重置
    setAmount('');
    setNote('');
    onClose();
  }, [fromId, toId, amount, note, onTransfer, onClose]);

  const canConfirm = parseFloat(amount) > 0 && fromId !== toId;

  // 账户选择器面板
  const renderAccountPicker = (target) => {
    const currentId = target === 'from' ? fromId : toId;
    return (
      <View style={styles.pickerBackdrop}>
        <Pressable style={styles.pickerBackdropInner} onPress={() => setPickerTarget(null)} />
        <View style={[styles.pickerSheet, { backgroundColor: tc.surface }]}>
          <View style={[styles.pickerHandle, { backgroundColor: tc.divider }]} />
          <Text style={[styles.pickerTitle, { color: tc.text }]}>
            选择{target === 'from' ? '转出' : '转入'}账户
          </Text>
          <ScrollView style={styles.pickerList} bounces={false}>
            {accounts.map(acc => {
              const info = typeInfo(acc.type);
              const active = acc.id === currentId;
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.pickerRow,
                    { backgroundColor: active ? tc.primarySubtle : 'transparent' },
                  ]}
                  onPress={() => {
                    if (target === 'from') setFromId(acc.id);
                    else setToId(acc.id);
                    setPickerTarget(null);
                  }}
                  activeOpacity={0.6}
                >
                  <AccountIcon type={acc.type} size={36} color={acc.color || info.color} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[styles.pickerName, { color: tc.text }]} numberOfLines={1}>
                      {acc.name}
                    </Text>
                    <Text style={[styles.pickerBalance, { color: tc.textMuted }]}>
                      {formatMoney(acc.balance, currency)}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={tc.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: tc.surface, borderColor: tc.border }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: tc.divider }]} />
          <Text style={[styles.title, { color: tc.text }]}>账户转账</Text>

          {/* 转出账户 */}
          <Text style={[styles.label, { color: tc.textMuted }]}>转出账户</Text>
          <TouchableOpacity
            style={[styles.accountSelect, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
            onPress={() => setPickerTarget('from')}
            activeOpacity={0.7}
          >
            {fromAccount ? (
              <>
                <AccountIcon type={fromAccount.type} size={32} color={fromAccount.color || typeInfo(fromAccount.type).color} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.selectName, { color: tc.text }]}>{fromAccount.name}</Text>
                  <Text style={[styles.selectBalance, { color: tc.textSubtle }]}>
                    余额 {formatMoney(fromAccount.balance, currency)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ color: tc.textSubtle }}>选择账户</Text>
            )}
            <Ionicons name="chevron-down" size={16} color={tc.textSubtle} />
          </TouchableOpacity>

          {/* 交换按钮 */}
          <View style={styles.swapRow}>
            <View style={[styles.swapLine, { backgroundColor: tc.divider }]} />
            <TouchableOpacity
              style={[styles.swapBtn, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
              onPress={handleSwap}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-vertical" size={18} color={tc.primary} />
            </TouchableOpacity>
            <View style={[styles.swapLine, { backgroundColor: tc.divider }]} />
          </View>

          {/* 转入账户 */}
          <Text style={[styles.label, { color: tc.textMuted }]}>转入账户</Text>
          <TouchableOpacity
            style={[styles.accountSelect, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
            onPress={() => setPickerTarget('to')}
            activeOpacity={0.7}
          >
            {toAccount ? (
              <>
                <AccountIcon type={toAccount.type} size={32} color={toAccount.color || typeInfo(toAccount.type).color} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.selectName, { color: tc.text }]}>{toAccount.name}</Text>
                  <Text style={[styles.selectBalance, { color: tc.textSubtle }]}>
                    余额 {formatMoney(toAccount.balance, currency)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ color: tc.textSubtle }}>选择账户</Text>
            )}
            <Ionicons name="chevron-down" size={16} color={tc.textSubtle} />
          </TouchableOpacity>

          {/* 金额 */}
          <Text style={[styles.label, { color: tc.textMuted }]}>转账金额</Text>
          <TextInput
            style={[styles.amountInput, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={tc.textSubtle}
            keyboardType="decimal-pad"
            autoFocus
          />

          {/* 备注 */}
          <Text style={[styles.label, { color: tc.textMuted }]}>备注（可选）</Text>
          <TextInput
            style={[styles.noteInput, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
            value={note}
            onChangeText={setNote}
            placeholder="例如：提现到银行卡"
            placeholderTextColor={tc.textSubtle}
            maxLength={50}
          />

          {/* 确认按钮 */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              { backgroundColor: canConfirm ? tc.primary : tc.surfaceMuted },
            ]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={!canConfirm}
          >
            <Text style={[styles.confirmText, { color: canConfirm ? tc.primaryOn || '#fff' : tc.textSubtle }]}>
              确认转账
            </Text>
          </TouchableOpacity>

          {fromId === toId && accounts.length >= 2 && (
            <Text style={[styles.errorHint, { color: tc.danger }]}>
              转出和转入不能是同一个账户
            </Text>
          )}
        </Pressable>
      </Pressable>

      {/* 账户选择器（覆盖在弹窗之上） */}
      {pickerTarget && renderAccountPicker(pickerTarget)}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: fontSize.xs,
    marginTop: spacing.md,
    marginBottom: 6,
    letterSpacing: -0.1,
  },

  // 账户选择器
  accountSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  selectName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  selectBalance: {
    fontSize: fontSize.xs,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  // 交换按钮
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  swapLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },

  // 金额输入
  amountInput: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },

  // 备注
  noteInput: {
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    height: 40,
    fontSize: fontSize.md,
  },

  // 确认按钮
  confirmBtn: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  errorHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // 账户选择器面板
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  pickerBackdropInner: {
    flex: 1,
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
    maxHeight: '60%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  pickerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  pickerBalance: {
    fontSize: fontSize.xs,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});

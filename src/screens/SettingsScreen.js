// 璐璐记账 · 设置
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFinance } from '../context/FinanceContext';
import { triggerUpdateCheck, getLastUpdateCheck } from '../components/UpdatePrompt';
import { Button } from '../components/SharedComponents';
import AiSettingsScreen from './AiSettingsScreen';
import { formatMoney, getCurrencyList } from '../utils/currency';
import { exportTransactionsToCSV, exportToJSON, parseImportText, pickImportFile } from '../utils/export';
import { exportAllData, importData } from '../utils/storage';
import { Section, ActionRow } from "./settings/Section";
import BookManagerSection from "./settings/BookManagerSection";
import BudgetSection from "./settings/BudgetSection";
import CurrencySection from "./settings/CurrencySection";
import AppearanceSection from "./settings/AppearanceSection";
import UpdateSection from "./settings/UpdateSection";
import RecurringSection from "./settings/RecurringSection";
import DataSection from "./settings/DataSection";
import AiSection from "./settings/AiSection";
import StatsSection from "./settings/StatsSection";
import AboutSection from "./settings/AboutSection";
import {
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  getThemeColors,
} from '../theme';

function hexAlpha(hex, a) {
  if (!hex) return hex;
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

function checkResultText(r) {
  if (!r) return '';
  switch (r.status) {
    case 'checking': return '正在检查…';
    case 'disabled': return '自动检查已关闭，但仍会查一次';
    case 'up-to-date': return '已是最新版本 (v' + r.latest + ')';
    case 'update-available': return '有新版 v' + r.latest + ' 可用';
    case 'dismissed': return '已忽略 v' + r.latest + '，7 天内不再提示';
    case 'error': return '检查失败：' + (r.error || '未知错误');
    default: return '';
  }
}

function formatTimeAgo(ms) {
  if (!ms || ms <= 0) return '从未';
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return sec + ' 秒前';
  if (sec < 3600) return Math.floor(sec / 60) + ' 分钟前';
  if (sec < 86400) return Math.floor(sec / 3600) + ' 小时前';
  return Math.floor(sec / 86400) + ' 天前';
}

export default function SettingsScreen({ navigation }) {
  const {
    books,
    currentBookId,
    transactions,
    settings,
    recurring,
    switchBook,
    createBook,
    editBook,
    removeBook,
    addRecurringItem,
    removeRecurringItem,
    updateAppSettings,
    reload,
  } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [showBookModal, setShowBookModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [newBookName, setNewBookName] = useState('');
  const [newBookIcon, setNewBookIcon] = useState('wallet');
  const [newBookColor, setNewBookColor] = useState('#7C5CFF');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    category: '',
    amount: '',
    frequency: 'monthly',
    note: '',
    type: 'expense',
  });

  const bookIcons = ['wallet', 'cash', 'card', 'business', 'school', 'heart', 'airplane', 'restaurant'];
  const bookColors = [
    '#111827', '#7C5CFF', '#0EA5E9', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#64748B',
  ];

  const openAddBook = () => {
    setEditingBook(null);
    setNewBookName('');
    setNewBookIcon('wallet');
    setNewBookColor('#7C5CFF');
    setShowBookModal(true);
  };
  const openEditBook = (book) => {
    setEditingBook(book);
    setNewBookName(book.name);
    setNewBookIcon(book.icon);
    setNewBookColor(book.color);
    setShowBookModal(true);
  };
  const handleSaveBook = async () => {
    if (!newBookName.trim()) {
      Alert.alert('提示', '请输入账本名称');
      return;
    }
    if (editingBook) {
      await editBook(editingBook.id, { name: newBookName, icon: newBookIcon, color: newBookColor });
    } else {
      await createBook({
        id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newBookName,
        icon: newBookIcon,
        color: newBookColor,
        currency: settings.currency,
        createdAt: new Date().toISOString(),
      });
    }
    setShowBookModal(false);
  };
  const handleDeleteBook = (book) => {
    if (books.length <= 1) {
      Alert.alert('提示', '至少需要保留一个账本');
      return;
    }
    Alert.alert('删除账本', `确定删除「${book.name}」吗?该账本下的所有记录也会被删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeBook(book.id) },
    ]);
  };
  const handleSwitchBook = async (bookId) => {
    await switchBook(bookId);
  };

  const handleCurrencyChange = async (code) => {
    await updateAppSettings({ currency: code });
    setShowCurrencyModal(false);
  };

  const handleExportCSV = async () => {
    try {
      await exportTransactionsToCSV(transactions, settings.currency);
    } catch (e) {
      Alert.alert('导出失败', e.message);
    }
  };
  const handleExportJSON = async () => {
    try {
      const data = await exportAllData();
      await exportToJSON(data);
    } catch (e) {
      Alert.alert('导出失败', e.message);
    }
  };

  const handleToggleTheme = async () => {
    await updateAppSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };
  const handleToggleProxy = async () => {
    await updateAppSettings({ useProxy: !settings.useProxy });
  };

  const handleToggleAutoCheck = async () => {
    await updateAppSettings({ autoCheckUpdate: !settings.autoCheckUpdate });
  };

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = React.useState(null);
  // handleCheckNow: trigger UpdatePrompt to run a check, then poll
  // getLastUpdateCheck every 250ms until the status moves out of
  // \'checking\'. This is much simpler than wiring up a manual
  // DeviceEventEmitter subscription, and the polling cleanup is
  // automatic via the isChecking useEffect.
  const handleCheckNow = () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckResult(null);
    try { triggerUpdateCheck(true); } catch (e) { console.warn('[Settings] trigger failed:', e?.message || e); }
  };
  // Poll the module-level _lastCheck while isChecking is true.
  useEffect(() => {
    if (!isChecking) return;
    let cancelled = false;
    const start = Date.now();
    const id = setInterval(() => {
      if (cancelled) return;
      const lc = getLastUpdateCheck();
      const elapsed = Date.now() - start;
      if (lc && lc.status && lc.status !== 'checking' && lc.status !== 'never') {
        if (mountedRef.current) setCheckResult(lc);
        if (mountedRef.current) setIsChecking(false);
        return;
      }
      if (elapsed > 15000) {
        if (mountedRef.current) setCheckResult({ status: 'error', error: '检查超时' });
        if (mountedRef.current) setIsChecking(false);
      }
    }, 250);
    return () => { cancelled = true; clearInterval(id); };
  }, [isChecking]);

  const handleAddRecurring = async () => {
    if (!recurringForm.category || !recurringForm.amount) {
      Alert.alert('提示', '请填写分类和金额');
      return;
    }
    await addRecurringItem({
      category: recurringForm.category,
      amount: parseFloat(recurringForm.amount),
      frequency: recurringForm.frequency,
      note: recurringForm.note,
      type: recurringForm.type,
      currency: settings.currency,
    });
    setShowRecurringModal(false);
    setRecurringForm({ category: '', amount: '', frequency: 'monthly', note: '', type: 'expense' });
  };
  const handleDeleteRecurring = (id) => {
    Alert.alert('删除周期交易', '确定删除这条周期性交易吗?', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeRecurringItem(id) },
    ]);
  };

  const handleImport = async () => {
    if (!importJson.trim()) {
      Alert.alert('提示', '请粘贴备份数据');
      return;
    }
    try {
      const parsed = parseImportText(importJson);
      const result = await importData(parsed.format === "json" ? parsed.fullData : parsed.transactions);
      await reload();
      setShowImportModal(false);
      setImportJson('');
      const added = (result && result.added) || 0;
      const skipped = (result && result.skipped) || 0;
      const fmt = (result && result.format) || parsed.format || "csv";
      const skipHint = skipped > 0 ? `(跳过 ${skipped} 条重复)` : "";
      Alert.alert('导入成功', `格式：${fmt.toUpperCase()}\n新增 ${added} 条交易记录${skipHint}`);
    } catch (e) {
      Alert.alert('导入失败', e && e.message ? e.message : '数据格式不正确,请检查后重试');
    }
  };

  const handlePickFile = async () => {
    try {
      const picked = await pickImportFile();
      if (!picked) return;
      setImportJson(picked.text);
      Alert.alert('已选择文件', `文件：${picked.name}\n已自动填入下方文本框，点击"导入"完成导入`);
    } catch (e) {
      Alert.alert('选择文件失败', e && e.message ? e.message : '请重试');
    }
  };

  const totalTxCount = transactions.length;
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.brand, { color: tc.textMuted }]}>个人</Text>
          <Text style={[styles.title, { color: tc.text }]}>设置</Text>
        </View>

        <BookManagerSection
          books={books}
          currentBookId={currentBookId}
          onSwitch={handleSwitchBook}
          onEdit={openEditBook}
          onAdd={openAddBook}
        />
        <BudgetSection onNavigate={() => navigation.navigate("Budget")} />
        <CurrencySection onOpenModal={() => setShowCurrencyModal(true)} />
        <AppearanceSection onToggleTheme={handleToggleTheme} />
        <UpdateSection
          isChecking={isChecking}
          checkResult={checkResult}
          checkResultText={checkResultText}
          formatTimeAgo={formatTimeAgo}
          onToggleProxy={handleToggleProxy}
          onToggleAutoCheck={handleToggleAutoCheck}
          onCheckNow={handleCheckNow}
        />
        <RecurringSection
          recurring={recurring}
          onAdd={() => setShowRecurringModal(true)}
          onDelete={handleDeleteRecurring}
        />
        <DataSection
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          onOpenImportModal={() => setShowImportModal(true)}
        />
        <AiSection onOpenModal={() => setShowAiModal(true)} />
        <StatsSection
          totalTxCount={totalTxCount}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
        />
        <AboutSection />
      </ScrollView>

      <AiSettingsScreen visible={showAiModal} onClose={() => setShowAiModal(false)} />

      <Modal visible={showBookModal} transparent animationType="slide" onRequestClose={() => setShowBookModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowBookModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>
                {editingBook ? '编辑账本' : '新建账本'}
              </Text>
              <TouchableOpacity onPress={() => setShowBookModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tc.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: tc.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm, lineHeight: 20 }}>支持 JSON 完整备份 或 CSV 文本。自动识别格式，重复数据会被跳过。</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>账本名称</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text }]}
                value={newBookName}
                onChangeText={setNewBookName}
                  autoCorrect={false}
                  autoCapitalize="none"
                  autoComplete="off"
                placeholder="输入账本名称"
                placeholderTextColor={tc.textSubtle}
                maxLength={20}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>选择图标</Text>
              <View style={styles.iconGrid}>
                {bookIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                      newBookIcon === icon && { borderColor: newBookColor, backgroundColor: hexAlpha(newBookColor, 0.08) },
                    ]}
                    onPress={() => setNewBookIcon(icon)}
                  >
                    <Ionicons name={icon} size={20} color={newBookIcon === icon ? newBookColor : tc.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>选择颜色</Text>
              <View style={styles.colorGrid}>
                {bookColors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newBookColor === color && { borderColor: tc.text, borderWidth: 3 },
                    ]}
                    onPress={() => setNewBookColor(color)}
                  >
                    {newBookColor === color ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              {editingBook ? (
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: tc.dangerSubtle }]}
                  onPress={() => { setShowBookModal(false); handleDeleteBook(editingBook); }}
                >
                  <Ionicons name="trash-outline" size={18} color={tc.danger} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: tc.primary }]}
                onPress={handleSaveBook}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCurrencyModal} transparent animationType="fade" onRequestClose={() => setShowCurrencyModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCurrencyModal(false)}>
          <View style={[styles.currencyList, { backgroundColor: tc.surface, marginBottom: insets.bottom + spacing.lg }]}>
            {getCurrencyList().map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.currencyItem, { borderBottomColor: tc.divider }]}
                onPress={() => handleCurrencyChange(c.code)}
              >
                <Text style={[styles.currencyLabel, { color: tc.text }]}>{c.label}</Text>
                {settings.currency === c.code ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowImportModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg, maxHeight: '90%' }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>导入备份</Text>
              <TouchableOpacity onPress={() => { setShowImportModal(false); setImportJson(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tc.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: spacing.sm }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={[styles.inputLabel, { color: tc.textMuted, marginBottom: 0 }]}>粘贴或选择文件</Text>
                  <TouchableOpacity
                    onPress={handlePickFile}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: tc.surfaceMuted, borderRadius: borderRadius.md }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="folder-open-outline" size={16} color={tc.primary} />
                    <Text style={{ color: tc.primary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>选择文件</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text, minHeight: 100, maxHeight: 180, textAlignVertical: 'top' }]}
                  value={importJson}
                  onChangeText={setImportJson}
                  placeholder='支持 JSON 完整备份 或 CSV 文本（可点右上角选择文件）'
                  placeholderTextColor={tc.textSubtle}
                  autoCorrect={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  multiline
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary, marginTop: spacing.sm, flex: 0, height: 48 }]}
              onPress={handleImport}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>导入</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showRecurringModal} transparent animationType="slide" onRequestClose={() => setShowRecurringModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowRecurringModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>添加周期性交易</Text>
              <TouchableOpacity onPress={() => setShowRecurringModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tc.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>类型</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[{ key: 'expense', label: '支出' }, { key: 'income', label: '收入' }].map((t) => {
                  const active = recurringForm.type === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.typePill,
                        { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                        active && { backgroundColor: tc.primary, borderColor: tc.primary },
                      ]}
                      onPress={() => setRecurringForm({ ...recurringForm, type: t.key })}
                    >
                      <Text style={[styles.typePillText, { color: tc.textSecondary }, active && { color: tc.primaryOn }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>分类</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text }]}
                value={recurringForm.category}
                onChangeText={(v) => setRecurringForm({ ...recurringForm, category: v })}
                    autoCorrect={false}
                    autoCapitalize="none"
                    autoComplete="off"
                placeholder="如：工资 / 房租"
                placeholderTextColor={tc.textSubtle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>金额</Text>
              <View style={[styles.amountRow, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <Text style={[styles.currency, { color: tc.textMuted }]}>
                  {settings.currency === 'CNY' ? '¥' : '$'}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: tc.text }]}
                  value={recurringForm.amount}
                  onChangeText={(v) => setRecurringForm({ ...recurringForm, amount: v })}
                    autoCorrect={false}
                    autoCapitalize="none"
                    autoComplete="off"
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={tc.textSubtle}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>频率</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[{ key: 'daily', label: '每天' }, { key: 'weekly', label: '每周' }, { key: 'monthly', label: '每月' }, { key: 'yearly', label: '每年' }].map((f) => {
                  const active = recurringForm.frequency === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[
                        styles.typePill,
                        { backgroundColor: tc.surfaceMuted, borderColor: 'transparent' },
                        active && { backgroundColor: tc.primary, borderColor: tc.primary },
                      ]}
                      onPress={() => setRecurringForm({ ...recurringForm, frequency: f.key })}
                    >
                      <Text style={[styles.typePillText, { color: tc.textSecondary }, active && { color: tc.primaryOn }]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: tc.textMuted }]}>备注 (选填)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text }]}
                value={recurringForm.note}
                onChangeText={(v) => setRecurringForm({ ...recurringForm, note: v })}
                    autoCorrect={false}
                    autoCapitalize="none"
                    autoComplete="off"
                placeholder="如：每月15号发工资"
                placeholderTextColor={tc.textSubtle}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary, marginTop: spacing.sm, flex: 0, height: 48 }]}
              onPress={handleAddRecurring}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBtnText, { color: tc.primaryOn }]}>保存</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

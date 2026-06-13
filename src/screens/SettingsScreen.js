// 璐璐记账 · 设置
import React, { useState } from 'react';
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
import { useFinance } from '../context/FinanceContext';
import { Button } from '../components/SharedComponents';
import { formatMoney, getCurrencyList } from '../utils/currency';
import { exportTransactionsToCSV, exportToJSON, parseImportText, pickImportFile } from '../utils/export';
import { exportAllData, importData } from '../utils/storage';
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

        <Section title="账本管理" rightAction={
          <TouchableOpacity onPress={openAddBook} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add" size={22} color={tc.text} />
          </TouchableOpacity>
        }>
          {books.map((book) => {
            const active = book.id === currentBookId;
            return (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.listItem,
                  {
                    backgroundColor: tc.surface,
                    borderColor: active ? tc.primary : tc.border,
                    borderWidth: active ? 1 : StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={() => handleSwitchBook(book.id)}
                onLongPress={() => openEditBook(book)}
                activeOpacity={0.7}
              >
                <View style={[styles.listIcon, { backgroundColor: hexAlpha(book.color, 0.12) }]}>
                  <Ionicons name={book.icon} size={18} color={book.color} />
                </View>
                <View style={styles.listContent}>
                  <Text style={[styles.listTitle, { color: tc.text }]}>
                    {book.name}
                  </Text>
                  <Text style={[styles.listSub, { color: tc.textMuted }]}>
                    {active ? '当前使用' : '点击切换'}
                  </Text>
                </View>
                {active ? <View style={[styles.activeDot, { backgroundColor: tc.primary }]} /> : null}
              </TouchableOpacity>
            );
          })}
        </Section>

        <Section title="预算管理">
          <TouchableOpacity
            style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={() => navigation.navigate('Budget')}
            activeOpacity={0.7}
          >
            <View style={[styles.listIcon, { backgroundColor: hexAlpha('#F59E0B', 0.12) }]}>
              <Ionicons name="pie-chart" size={18} color="#F59E0B" />
            </View>
            <View style={styles.listContent}>
              <Text style={[styles.listTitle, { color: tc.text }]}>月度预算</Text>
              <Text style={[styles.listSub, { color: tc.textMuted }]}>
                设置各分类的月度预算上限
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tc.textSubtle} />
          </TouchableOpacity>
        </Section>

        <Section title="货币设置">
          <TouchableOpacity
            style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={() => setShowCurrencyModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
              <Ionicons name="globe-outline" size={18} color={tc.text} />
            </View>
            <View style={styles.listContent}>
              <Text style={[styles.listTitle, { color: tc.text }]}>默认货币</Text>
            </View>
            <View style={styles.rightMeta}>
              <Text style={[styles.rightText, { color: tc.textMuted }]}>{settings.currency}</Text>
              <Ionicons name="chevron-forward" size={16} color={tc.textSubtle} />
            </View>
          </TouchableOpacity>
        </Section>

        <Section title="外观设置">
          <TouchableOpacity
            style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={handleToggleTheme}
            activeOpacity={0.7}
          >
            <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
              <Ionicons
                name={settings.theme === 'dark' ? 'moon' : 'sunny-outline'}
                size={18}
                color={tc.text}
              />
            </View>
            <View style={styles.listContent}>
              <Text style={[styles.listTitle, { color: tc.text }]}>深色模式</Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                { backgroundColor: settings.theme === 'dark' ? tc.primary : tc.surfaceMuted },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  {
                    transform: [{ translateX: settings.theme === 'dark' ? 20 : 0 }],
                    backgroundColor: settings.theme === 'dark' ? tc.primaryOn : tc.white,
                  },
                ]}
              />
            </View>
          </TouchableOpacity>
        </Section>

        <Section title="周期性交易" rightAction={
          <TouchableOpacity onPress={() => setShowRecurringModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add" size={22} color={tc.text} />
          </TouchableOpacity>
        }>
          {recurring.length > 0 ? (
            recurring.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
                onLongPress={() => handleDeleteRecurring(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
                  <Ionicons name="repeat" size={18} color={tc.text} />
                </View>
                <View style={styles.listContent}>
                  <Text style={[styles.listTitle, { color: tc.text }]}>{item.category}</Text>
                  <Text style={[styles.listSub, { color: tc.textMuted }]}>
                    {item.frequency === 'daily' ? '每天' : item.frequency === 'weekly' ? '每周' : item.frequency === 'monthly' ? '每月' : '每年'}
                    {item.note ? ' · ' + item.note : ''}
                  </Text>
                </View>
                <Text style={[styles.rightText, { color: tc.text, fontWeight: fontWeight.semibold }]}>
                  {formatMoney(item.amount, item.currency)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border, justifyContent: 'center' }]}>
              <Text style={[styles.listSub, { color: tc.textMuted }]}>暂无周期性交易</Text>
            </View>
          )}
        </Section>
        <Section title="数据管理">
          <ActionRow
            icon="document-text-outline"
            iconColor={tc.text}
            iconBg={tc.surfaceMuted}
            label="导出为 CSV"
            onPress={handleExportCSV}
            rightIcon="download-outline"
          />
          <ActionRow
            icon="cloud-upload-outline"
            iconColor={tc.text}
            iconBg={tc.surfaceMuted}
            label="完整备份导出"
            onPress={handleExportJSON}
            rightIcon="download-outline"
          />
          <ActionRow
            icon="download-outline"
            iconColor={tc.text}
            iconBg={tc.surfaceMuted}
            label="导入备份"
            onPress={() => setShowImportModal(true)}
          />
        </Section>

        <Section title="数据统计">
          <View style={styles.statRow}>
            <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <Text style={[styles.statLabel, { color: tc.textMuted }]}>总交易</Text>
              <Text style={[styles.statValue, { color: tc.text }]}>{totalTxCount}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <Text style={[styles.statLabel, { color: tc.textMuted }]}>总收入</Text>
              <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(totalIncome, settings.currency)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <Text style={[styles.statLabel, { color: tc.textMuted }]}>总支出</Text>
              <Text style={[styles.statValue, { color: tc.text }]}>{formatMoney(totalExpense, settings.currency)}</Text>
            </View>
          </View>
        </Section>

        <Section title="关于">
          <View style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}>
            <View style={[styles.listIcon, { backgroundColor: hexAlpha(tc.accent, 0.12) }]}>
              <Ionicons name="sparkles" size={18} color={tc.accent} />
            </View>
            <View style={styles.listContent}>
              <Text style={[styles.listTitle, { color: tc.text }]}>璐璐记账</Text>
            </View>
            <Text style={[styles.rightText, { color: tc.textMuted }]}>v1.0.0</Text>
          </View>
        </Section>
      </ScrollView>

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
          <View style={[styles.modalContent, { backgroundColor: tc.surface, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>导入备份</Text>
              <TouchableOpacity onPress={() => { setShowImportModal(false); setImportJson(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={tc.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                style={[styles.textInput, { backgroundColor: tc.surfaceMuted, color: tc.text, minHeight: 180, textAlignVertical: 'top' }]}
                value={importJson}
                onChangeText={setImportJson}
                placeholder='支持 JSON 完整备份 或 CSV 文本（可点右上角选择文件）'
                placeholderTextColor={tc.textSubtle}
                  autoCorrect={false}
                  autoCapitalize="none"
                  autoComplete="off"
                placeholder={'{"transactions":[...]}'}
                placeholderTextColor={tc.textSubtle}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tc.primary, marginTop: spacing.sm }]}
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
              style={[styles.saveBtn, { backgroundColor: tc.primary, marginTop: spacing.sm }]}
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
function Section({ title, rightAction, children }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: tc.textMuted }]}>{title}</Text>
        {rightAction}
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function ActionRow({ icon, iconColor, iconBg, label, onPress, rightIcon }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.listIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.listContent}>
        <Text style={[styles.listTitle, { color: tc.text }]}>{label}</Text>
      </View>
      {rightIcon ? <Ionicons name={rightIcon} size={16} color={tc.textMuted} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl },

  headerRow: { paddingBottom: spacing.lg },
  brand: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.6, marginTop: 2 },

  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { flex: 1, marginLeft: spacing.md },
  listTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: -0.2 },
  listSub: { fontSize: fontSize.sm, marginTop: 2, letterSpacing: -0.1 },
  rightMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rightText: { fontSize: fontSize.md, letterSpacing: -0.2 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },

  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { fontSize: fontSize.xs, letterSpacing: -0.1 },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D4D8',
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, letterSpacing: -0.3 },

  inputGroup: { marginBottom: spacing.base },
  inputLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.sm, letterSpacing: -0.1 },
  textInput: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
  },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconOption: {
    width: 48, height: 48, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorOption: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  typePill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.1,
  },

  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  deleteBtn: {
    width: 52, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  currency: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, marginRight: spacing.sm, letterSpacing: -0.3 },
  amountInput: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    paddingVertical: spacing.md,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  currencyList: {
    margin: spacing.base,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  currencyLabel: { fontSize: fontSize.md, letterSpacing: -0.2 },
});

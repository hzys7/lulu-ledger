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
import { formatMoney } from '../utils/currency';
import { exportTransactionsToCSV, exportToJSON, parseImportText, pickImportFile } from '../utils/export';
import { exportAllData, importData } from '../utils/storage';
import { Section, ActionRow } from "./settings/Section";
import BookModal from "./settings/BookModal";
import ImportModal from "./settings/ImportModal";
import RecurringModal from "./settings/RecurringModal";
import { styles } from "./settings/styles";
import BookManagerSection from "./settings/BookManagerSection";
import BudgetSection from "./settings/BudgetSection";
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
        <BookManagerSection
          books={books}
          currentBookId={currentBookId}
          onSwitch={handleSwitchBook}
          onEdit={openEditBook}
          onAdd={openAddBook}
        />
        <BudgetSection onNavigate={() => navigation.navigate("Budget")} />
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

      <BookModal
        visible={showBookModal}
        onClose={() => setShowBookModal(false)}
        editingBook={editingBook}
        newBookName={newBookName}
        setNewBookName={setNewBookName}
        newBookIcon={newBookIcon}
        setNewBookIcon={setNewBookIcon}
        newBookColor={newBookColor}
        setNewBookColor={setNewBookColor}
        onSave={handleSaveBook}
        onDelete={() => { setShowBookModal(false); handleDeleteBook(editingBook); }}
      />

      <ImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        importJson={importJson}
        setImportJson={setImportJson}
        onPickFile={handlePickFile}
        onImport={handleImport}
      />

      <RecurringModal
        visible={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        recurringForm={recurringForm}
        setRecurringForm={setRecurringForm}
        onSave={handleAddRecurring}
      />
    </View>
  );
}

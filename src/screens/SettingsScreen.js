// 小璐记账 · 设置
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../context/FinanceContext';
import { triggerUpdateCheck, getLastUpdateCheck } from '../components/UpdatePrompt';
import AiSettingsScreen from './AiSettingsScreen';
import { exportTransactionsToCSV, exportToJSON, parseImportText, pickImportFile } from '../utils/export';
import { exportAllData, importData } from '../utils/storage';
import ImportModal from "./settings/ImportModal";
import RecurringModal from "./settings/RecurringModal";
import { styles } from "./settings/styles";
import BudgetSection from "./settings/BudgetSection";
import AppearanceSection from "./settings/AppearanceSection";
import RecurringSection from "./settings/RecurringSection";
import DataSection from "./settings/DataSection";
import AiSection from "./settings/AiSection";
import AboutSection from "./settings/AboutSection";
import {
  spacing,
  getThemeColors,
} from '../theme';

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

export default function SettingsScreen({ navigation }) {
  const {
    transactions,
    settings,
    recurring,
    addRecurringItem,
    removeRecurringItem,
    updateAppSettings,
    reload,
    books,
    currentBookId,
  } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

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
    startDate: '',
  });

  const handleExportCSV = async () => {
    try {
      await exportTransactionsToCSV(transactions, settings.currency, accounts);
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
  const handleToggleAutoCheck = async () => {
    await updateAppSettings({ autoCheckUpdate: !settings.autoCheckUpdate });
  };

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = React.useState(null);
  const handleCheckNow = () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckResult(null);
    try { triggerUpdateCheck(true); } catch (e) { console.warn('[Settings] trigger failed:', e?.message || e); }
  };
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
      startDate: recurringForm.startDate,
    });
    setShowRecurringModal(false);
    setRecurringForm({ category: '', amount: '', frequency: 'monthly', note: '', type: 'expense', startDate: '' });
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
      // 对 CSV 导入的交易，根据 bookName 匹配正确的 bookId
      if (parsed.format === 'csv' && Array.isArray(parsed.transactions)) {
        const bookMap = Object.fromEntries((books || []).map(b => [b.name, b.id]));
        parsed.transactions.forEach(t => {
          const matchedId = t.bookName && bookMap[t.bookName];
          t.bookId = matchedId || currentBookId;
        });
      }
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

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl + 40 },
        ]}
      >
        <BudgetSection onNavigate={() => navigation.navigate("Budget")} />
        <AppearanceSection onToggleTheme={handleToggleTheme} />
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
        <AboutSection
          isChecking={isChecking}
          checkResult={checkResult}
          checkResultText={checkResultText}
          onToggleAutoCheck={handleToggleAutoCheck}
          onCheckNow={handleCheckNow}
        />
      </ScrollView>

      <AiSettingsScreen visible={showAiModal} onClose={() => setShowAiModal(false)} />

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

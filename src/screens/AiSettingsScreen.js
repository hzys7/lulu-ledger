// 璐璐记账 · AI 配置弹窗
// 风格：仿截图样式（机器人图标 + 表单 + 底部三按钮）
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../context/FinanceContext';
import { spacing, borderRadius, fontSize, fontWeight, getThemeColors } from '../theme';
import { AI_PROVIDERS, DEFAULT_CONFIG, loadAiConfig, saveAiConfig, testAiConnection } from '../utils/aiConfig';

export default function AiSettingsScreen({ visible, onClose }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const insets = useSafeAreaInsets();

  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      (async () => {
        const loaded = await loadAiConfig();
        setConfig(loaded);
        setTestResult(null);
      })();
    }
  }, [visible]);

  const providerInfo = AI_PROVIDERS[config.provider] || AI_PROVIDERS.custom;
  const modelList = providerInfo.models;

  function updateField(field, value) {
    setConfig(c => ({ ...c, [field]: value }));
    setTestResult(null);
  }

  function handleProviderChange(newProvider) {
    const p = AI_PROVIDERS[newProvider];
    setConfig(c => ({
      ...c,
      provider: newProvider,
      baseURL: p.defaultBaseURL,
      model: p.models[0] || '__custom__',
      customModel: '',
    }));
    setShowProviderPicker(false);
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await testAiConnection(config);
    setTesting(false);
    setTestResult(res);
  }

  async function handleSave() {
    if (!config.apiKey) {
      Alert.alert('提示', '请填写 API Key');
      return;
    }
    if (config.provider === 'custom' && !config.baseURL) {
      Alert.alert('提示', '请填写接口地址');
      return;
    }
    if (config.model === '__custom__' && !config.customModel) {
      Alert.alert('提示', '请填写模型名称');
      return;
    }
    setSaving(true);
    const finalConfig = { ...config };
    await saveAiConfig(finalConfig);
    setSaving(false);
    onClose?.(finalConfig);
  }

  async function handleClear() {
    Alert.alert('清除配置', '确定要清除 AI 配置吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          setConfig({ ...DEFAULT_CONFIG });
          setTestResult(null);
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kbWrap}
        >
          <Pressable
            onPress={() => {}}
            style={[
              styles.sheet,
              {
                backgroundColor: tc.surface,
                paddingBottom: insets.bottom + spacing.sm,
              },
            ]}
          >
            <View style={styles.handle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* 标题 */}
              <View style={styles.header}>
                <Text style={styles.headerIcon}>🤖</Text>
                <Text style={[styles.headerTitle, { color: tc.text }]}>AI 配置</Text>
              </View>

              {/* 说明 */}
              <Text style={[styles.intro, { color: tc.textMuted }]}>
                配置完成后，可以在记账时用自然语言输入（如「昨天打车 35」），AI 会自动解析成账目。API Key 仅保存在你的设备本地。
              </Text>

              {/* 启用开关 */}
              <View style={[styles.toggleRow, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleTitle, { color: tc.text }]}>启用 AI 功能</Text>
                  <Text style={[styles.toggleHint, { color: tc.textMuted }]}>关闭后首页不会显示 AI 入口</Text>
                </View>
                <Switch
                  value={!!config.enabled}
                  onValueChange={(v) => updateField('enabled', v)}
                  trackColor={{ false: tc.border, true: tc.primary }}
                  thumbColor={'#FFFFFF'}
                />
              </View>

              {/* 服务商 */}
              <Text style={[styles.label, { color: tc.textMuted }]}>服务商</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
                onPress={() => setShowProviderPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.inputText, { color: tc.text }]}>{providerInfo.label}</Text>
                <Ionicons name="chevron-down" size={18} color={tc.textMuted} />
              </TouchableOpacity>

              {/* API Key */}
              <Text style={[styles.label, { color: tc.textMuted }]}>API Key</Text>
              <View style={[styles.input, styles.keyInputWrap, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}>
                <TextInput
                  style={[styles.input, styles.keyInput, { color: tc.text }]}
                  value={config.apiKey}
                  onChangeText={(v) => updateField('apiKey', v)}
                  placeholder="sk-..."
                  placeholderTextColor={tc.textSubtle}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                />
                <TouchableOpacity onPress={() => setShowApiKey(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={tc.textMuted} />
                </TouchableOpacity>
              </View>

              {/* 接口地址 */}
              <Text style={[styles.label, { color: tc.textMuted }]}>
                接口地址 (baseURL)
                {config.provider !== 'custom' ? (
                  <Text style={{ color: tc.textSubtle }}> · 留空用默认</Text>
                ) : null}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border }]}
                value={config.baseURL}
                onChangeText={(v) => updateField('baseURL', v)}
                placeholder={providerInfo.defaultBaseURL || 'https://your-api.com/v1'}
                placeholderTextColor={tc.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="url"
              />

              {/* 模型 */}
              <Text style={[styles.label, { color: tc.textMuted }]}>模型</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput, { backgroundColor: tc.surfaceMuted, borderColor: tc.border }]}
                onPress={() => setShowModelPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.inputText, { color: tc.text }]}>
                  {config.model === '__custom__' ? (config.customModel || '自定义...') : config.model}
                </Text>
                <Ionicons name="chevron-down" size={18} color={tc.textMuted} />
              </TouchableOpacity>
              {config.model === '__custom__' ? (
                <TextInput
                  style={[styles.input, { backgroundColor: tc.surfaceMuted, color: tc.text, borderColor: tc.border, marginTop: spacing.sm }]}
                  value={config.customModel}
                  onChangeText={(v) => updateField('customModel', v)}
                  placeholder="输入自定义模型名称"
                  placeholderTextColor={tc.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                />
              ) : null}

              <Text style={[styles.hint, { color: tc.textSubtle }]}>
                说明：任意 OpenAI 兼容端点
              </Text>

              {/* 测试结果 */}
              {testResult ? (
                <View
                  style={[
                    styles.testResult,
                    {
                      backgroundColor: testResult.ok ? tc.successSubtle : tc.dangerSubtle,
                      borderColor: testResult.ok ? tc.success : tc.danger,
                    },
                  ]}
                >
                  <Ionicons
                    name={testResult.ok ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={testResult.ok ? tc.success : tc.danger}
                  />
                  <Text style={[styles.testResultText, { color: testResult.ok ? tc.success : tc.danger }]}>
                    {testResult.message}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {/* 底部三按钮 */}
            <View style={[styles.footer, { borderTopColor: tc.divider }]}>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: tc.surfaceMuted }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.footerBtnText, { color: tc.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnMiddle, { backgroundColor: tc.surfaceMuted }]}
                onPress={handleTest}
                activeOpacity={0.7}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={tc.primary} />
                ) : (
                  <Text style={[styles.footerBtnText, { color: tc.text }]}>测试连接</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: tc.primary, flex: 1.4 }]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={tc.primaryOn} />
                ) : (
                  <Text style={[styles.footerBtnText, { color: tc.primaryOn, fontWeight: fontWeight.semibold }]}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      {/* 服务商选择弹窗 */}
      <Modal visible={showProviderPicker} transparent animationType="fade" onRequestClose={() => setShowProviderPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowProviderPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: tc.surface }]}>
            {Object.entries(AI_PROVIDERS).map(([key, info]) => (
              <TouchableOpacity
                key={key}
                style={[styles.pickerItem, config.provider === key && { backgroundColor: tc.surfaceMuted }]}
                onPress={() => handleProviderChange(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerItemText, { color: tc.text }]}>{info.label}</Text>
                {config.provider === key ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 模型选择弹窗 */}
      <Modal visible={showModelPicker} transparent animationType="fade" onRequestClose={() => setShowModelPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowModelPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: tc.surface }]}>
            {modelList.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerItem, config.model === m && { backgroundColor: tc.surfaceMuted }]}
                onPress={() => {
                  updateField('model', m);
                  setShowModelPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerItemText, { color: tc.text }]}>{m}</Text>
                {config.model === m ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.pickerItem, config.model === '__custom__' && { backgroundColor: tc.surfaceMuted }]}
              onPress={() => {
                updateField('model', '__custom__');
                setShowModelPicker(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, { color: tc.text }]}>自定义...</Text>
              {config.model === '__custom__' ? <Ionicons name="checkmark" size={18} color={tc.primary} /> : null}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  kbWrap: { width: '100%' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D4D8',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  scrollContent: { paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: { fontSize: fontSize.xl, marginRight: spacing.xs },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
  },
  intro: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.base,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    height: 44,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  keyInputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 },
  keyInput: { flex: 1, height: 44, paddingHorizontal: spacing.md, borderWidth: 0, backgroundColor: 'transparent' },
  hint: { fontSize: fontSize.xs, marginTop: spacing.xs, marginBottom: spacing.xs },
  testResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  testResultText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flex: 1 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  toggleTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 2 },
  toggleHint: { fontSize: fontSize.xs, lineHeight: 16 },

  // 底部
  footer: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnMiddle: { marginHorizontal: 0 },
  footerBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },

  // 选择器弹窗
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  pickerItemText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
});
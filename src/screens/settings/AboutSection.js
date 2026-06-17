// AboutSection: 关于 + 版本更新 - 合并为一个模块
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { Section } from './Section';
import { styles } from './styles';

function AboutSection({ isChecking, checkResult, checkResultText, onToggleAutoCheck, onCheckNow }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const version = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

  return (
    <Section title="关于">
      {/* 版本信息 */}
      <View style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}>
        <View style={[styles.listIcon, { backgroundColor: '#6C63FF' + '15' }]}>
          <Ionicons name="wallet" size={18} color="#6C63FF" />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>小璐记账</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            v{version} · AI 智能记账 APP
          </Text>
        </View>
      </View>

      {/* 自动检查更新 */}
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onToggleAutoCheck}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: '#007AFF' + '15' }]}>
          <Ionicons name="sync" size={18} color="#007AFF" />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>自动检查更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {settings.autoCheckUpdate ? '进入首页时自动检查' : '需要手动检查'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <View
            style={[
              styles.toggleTrack,
              {
                backgroundColor: settings.autoCheckUpdate ? '#007AFF' : tc.surfaceMuted,
                justifyContent: settings.autoCheckUpdate ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View style={[styles.toggleThumb, { backgroundColor: '#fff' }]} />
          </View>
        </View>
      </TouchableOpacity>

      {/* 手动检查更新 */}
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onCheckNow}
        activeOpacity={0.7}
        disabled={isChecking}
      >
        <View style={[styles.listIcon, { backgroundColor: '#007AFF' + '15' }]}>
          <Ionicons
            name={isChecking ? 'sync' : 'cloud-download-outline'}
            size={18}
            color="#007AFF"
          />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>检查更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {isChecking
              ? '正在检查…'
              : checkResult
              ? checkResultText(checkResult)
              : '点击检查新版本'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
        </View>
      </TouchableOpacity>
    </Section>
  );
}

export default AboutSection;

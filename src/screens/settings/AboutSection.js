// AboutSection: 关于 + 版本更新 - 合并为一个模块
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, neuStyles } from '../../theme';
import { Section } from './Section';
import { styles } from './styles';

function AboutSection({ isChecking, checkResult, checkResultText, onToggleAutoCheck, onCheckNow }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const neu = useMemo(() => neuStyles(tc), [tc]);
  const version = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

  return (
    <Section title="关于">
      {/* 版本信息 */}
      <View style={[styles.listItem, neu.raisedSm]}>
        <View style={[styles.listIcon, { backgroundColor: tc.primarySubtle }]}>
          <Ionicons name="wallet" size={18} color={tc.primary} />
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
        style={[styles.listItem, neu.raisedSm]}
        onPress={onToggleAutoCheck}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.infoSubtle }]}>
          <Ionicons name="sync" size={18} color={tc.info} />
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
              neu.inset,
              { justifyContent: settings.autoCheckUpdate ? 'flex-end' : 'flex-start' },
            ]}
          >
            <View style={[styles.toggleThumb, { backgroundColor: tc.white }]} />
          </View>
        </View>
      </TouchableOpacity>

      {/* 手动检查更新 */}
      <TouchableOpacity
        style={[styles.listItem, neu.raisedSm]}
        onPress={onCheckNow}
        activeOpacity={0.7}
        disabled={isChecking}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.infoSubtle }]}>
          <Ionicons
            name={isChecking ? 'sync' : 'cloud-download-outline'}
            size={18}
            color={tc.info}
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

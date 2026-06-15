// UpdateSection: proxy toggle, auto-check toggle, "check now" action,
// and a diagnostic info card showing the last update probe's current /
// latest / time-ago / status.
//
// All state lives in the parent SettingsScreen: isChecking + checkResult
// are passed in. The check-text helper is also imported from parent so
// this file stays purely presentational.
import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import { getLastUpdateCheck } from '../../components/UpdatePrompt';
import { Section } from './Section';
import { styles } from './styles';

function UpdateSection({
  isChecking,
  checkResult,
  checkResultText,
  formatTimeAgo,
  onToggleProxy,
  onToggleAutoCheck,
  onCheckNow,
}) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  return (
    <Section title="网络与更新">
      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onToggleProxy}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons name="globe" size={18} color={tc.text} />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>使用代理下载更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {settings.useProxy ? '开启：直连 GitHub（需翻墙）' : '关闭：用国内镜像（更稳）'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <View
            style={[
              styles.toggleTrack,
              {
                backgroundColor: settings.useProxy ? tc.primary : tc.surfaceMuted,
                justifyContent: settings.useProxy ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View style={[styles.toggleThumb, { backgroundColor: '#fff' }]} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onToggleAutoCheck}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons name="sync" size={18} color={tc.text} />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>自动检查更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {settings.autoCheckUpdate ? '开启：进入首页时自动检查' : '关闭：需要手动检查'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <View
            style={[
              styles.toggleTrack,
              {
                backgroundColor: settings.autoCheckUpdate ? tc.primary : tc.surfaceMuted,
                justifyContent: settings.autoCheckUpdate ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View style={[styles.toggleThumb, { backgroundColor: '#fff' }]} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.listItem, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onCheckNow}
        activeOpacity={0.7}
        disabled={isChecking}
      >
        <View style={[styles.listIcon, { backgroundColor: tc.surfaceMuted }]}>
          <Ionicons
            name={isChecking ? 'sync' : 'cloud-download-outline'}
            size={18}
            color={tc.text}
          />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>立即检查更新</Text>
          <Text style={[styles.listSub, { color: tc.textMuted }]}>
            {isChecking
              ? '正在检查…'
              : checkResult
              ? checkResultText(checkResult)
              : '手动触发一次更新检测'}
          </Text>
        </View>
        <View style={styles.rightMeta}>
          <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
        </View>
      </TouchableOpacity>
      <View
        style={[
          styles.listItem,
          {
            backgroundColor: tc.surfaceMuted,
            borderColor: tc.border,
            flexDirection: 'column',
            alignItems: 'flex-start',
            paddingVertical: 10,
          },
        ]}
      >
        <Text style={[styles.listSub, { color: tc.textMuted, marginTop: 0 }]}>诊断信息</Text>
        <Text
          style={[
            styles.listSub,
            {
              color: tc.textSecondary,
              marginTop: 4,
              fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
              fontSize: 11,
            },
          ]}
        >
          {(() => {
            const lc = getLastUpdateCheck();
            return [
              '当前: v' + (lc.current || '?'),
              '最新: v' + (lc.latest || '?'),
              '上次检查: ' + formatTimeAgo(lc.at),
              '状态: ' + (lc.status || 'never'),
            ].join(String.fromCharCode(10));
          })()}
        </Text>
      </View>
    </Section>
  );
}

export default UpdateSection;
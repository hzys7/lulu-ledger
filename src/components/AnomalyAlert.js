// 小璐记账 · 异常消费提醒卡片
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

export default function AnomalyAlert({ message, anomalies, onDismiss, tc }) {
  if (!message) return null;

  const severityIcon = (anomalies?.[0]?.severity === 'high') ? 'warning' : 'information-circle';
  const accentColor = (anomalies?.[0]?.severity === 'high') ? tc.danger : tc.accent;

  return (
    <View style={[styles.card, { backgroundColor: tc.surface, borderColor: tc.border }]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={severityIcon} size={18} color={accentColor} />
        </View>
        <Text style={[styles.messageText, { color: tc.text }]}>{message}</Text>
      </View>
      {anomalies && anomalies.length > 0 && (
        <View style={styles.detailWrap}>
          {anomalies.slice(0, 3).map((a, i) => (
            <View key={i} style={[styles.detailItem, { borderBottomColor: i < 2 ? tc.divider : 'transparent' }]}>
              <View style={[styles.severityDot, { backgroundColor: a.severity === 'high' ? tc.danger : tc.accent }]} />
              <Text style={[styles.detailText, { color: tc.textMuted }]} numberOfLines={1}>{a.detail}</Text>
            </View>
          ))}
        </View>
      )}
      {onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.6}>
          <Text style={[styles.dismissText, { color: tc.textSubtle }]}>知道了</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  messageText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  detailWrap: {
    marginTop: spacing.sm,
    paddingLeft: spacing.xl + spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    flex: 1,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingRight: spacing.xs,
  },
  dismissText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});

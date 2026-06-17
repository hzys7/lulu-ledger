// AppearanceSection: 外观设置（可折叠）
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors } from '../../theme';
import CollapsibleSection from './CollapsibleSection';

function AppearanceSection({ onToggleTheme }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);

  return (
    <CollapsibleSection
      title="外观设置"
      icon="color-palette-outline"
      iconColor="#AF52DE"
    >
      <TouchableOpacity
        style={[styles.row, { backgroundColor: tc.surface, borderColor: tc.border }]}
        onPress={onToggleTheme}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#AF52DE' + '15' }]}>
          <Ionicons
            name={settings.theme === 'dark' ? 'moon' : 'sunny-outline'}
            size={18}
            color="#AF52DE"
          />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, { color: tc.text }]}>深色模式</Text>
          <Text style={[styles.rowHint, { color: tc.textMuted }]}>
            {settings.theme === 'dark' ? '已开启' : '已关闭'}
          </Text>
        </View>
        <View
          style={[
            styles.toggleTrack,
            { backgroundColor: settings.theme === 'dark' ? '#AF52DE' : tc.surfaceMuted },
          ]}
        >
          <View
            style={[
              styles.toggleThumb,
              {
                transform: [{ translateX: settings.theme === 'dark' ? 20 : 0 }],
                backgroundColor: settings.theme === 'dark' ? '#fff' : tc.white,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowHint: {
    fontSize: 12,
    marginTop: 1,
  },
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
});

export default AppearanceSection;

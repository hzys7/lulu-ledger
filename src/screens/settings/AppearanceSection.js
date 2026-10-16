// AppearanceSection: 外观设置 - 简单行
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';
import { getThemeColors, neuStyles } from '../../theme';
import { Section } from './Section';
import { styles } from './styles';

function AppearanceSection({ onToggleTheme }) {
  const { settings } = useFinance();
  const tc = getThemeColors(settings.theme);
  const neu = useMemo(() => neuStyles(tc), [tc]);
  return (
    <Section title="外观设置">
      <TouchableOpacity
        style={[styles.listItem, neu.raisedSm]}
        onPress={onToggleTheme}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: '#AF52DE' + '15' }]}>
          <Ionicons
            name={settings.theme === 'dark' ? 'moon' : 'sunny-outline'}
            size={18}
            color="#AF52DE"
          />
        </View>
        <View style={styles.listContent}>
          <Text style={[styles.listTitle, { color: tc.text }]}>深色模式</Text>
        </View>
        <View style={[styles.toggleTrack, neu.inset]}>
          <View
            style={[
              styles.toggleThumb,
              {
                transform: [{ translateX: settings.theme === 'dark' ? 20 : 0 }],
                backgroundColor: tc.white,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Section>
  );
}

export default AppearanceSection;

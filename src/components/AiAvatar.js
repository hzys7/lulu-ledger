// 小璐记账 · AI助手组件（使用真实头像）
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, fontWeight } from '../theme';

export function AiAvatar({ size = 44, style }) {
  return (
    <View style={[styles.avatarContainer, { width: size, height: size }, style]}>
      <Image
        source={require('../../assets/xiaolu-avatar.jpg')}
        style={[styles.avatarImage, { width: size, height: size }]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImage: {
    borderRadius: 22,
  },
});

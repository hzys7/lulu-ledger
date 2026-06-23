// 小璐记账 · AI助手组件（使用真实头像，高清）
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

export function AiAvatar({ size = 44, style }) {
  const borderRadius = size / 2;
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
      <Image
        source={require('../../assets/xiaolu-avatar.jpg')}
        style={[styles.image, { width: size, height: size, borderRadius }]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {},
});

// 小璐记账 · 账户图标组件（支持自定义图片）
import React, { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 账户图标配置
const ACCOUNT_ICONS = {
  wechat: { icon: 'chatbubbles', color: '#07C160', bg: '#E8F8EE' },
  alipay: { icon: 'wallet', color: '#1677FF', bg: '#E6F0FF' },
  bank: { icon: 'business', color: '#722ED1', bg: '#F3E8FF' },
  cash: { icon: 'cash', color: '#FA8C16', bg: '#FFF3E6' },
  other: { icon: 'ellipsis-horizontal-circle', color: '#8C8C8C', bg: '#F3F4F6' },
};

// 如果有自定义图片，优先使用图片
const CUSTOM_IMAGES = {
  // wechat: require('../../assets/icons/wechat.png'),
  // alipay: require('../../assets/icons/alipay.png'),
  // bank: require('../../assets/icons/bank.png'),
  // cash: require('../../assets/icons/cash.png'),
};

function withAlpha(hex, alpha) {
  if (!hex) return hex;
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

export const AccountIcon = memo(function AccountIcon({ type, size = 42, icon, color }) {
  const config = ACCOUNT_ICONS[type] || ACCOUNT_ICONS.other;
  const hasCustomImage = CUSTOM_IMAGES[type];
  
  const iconColor = color || config.color;
  const bgColor = withAlpha(iconColor, 0.15);
  const iconSize = Math.round(size * 0.5);
  
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: bgColor }]}>
      {hasCustomImage ? (
        <Image
          source={CUSTOM_IMAGES[type]}
          style={{ width: iconSize, height: iconSize, borderRadius: iconSize * 0.2 }}
          resizeMode="contain"
        />
      ) : (
        <Ionicons name={config.icon} size={iconSize} color={iconColor} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

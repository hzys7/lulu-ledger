// 小璐记账 · 账户图标组件（支持自定义图片）
import React, { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNeu } from '../hooks/useThemeColors';

// 账户图标配置（color 为各渠道品牌色，用于图标本身）
const ACCOUNT_ICONS = {
  wechat: { icon: 'chatbubbles', color: '#07C160' },
  alipay: { icon: 'wallet', color: '#1677FF' },
  bank: { icon: 'business', color: '#722ED1' },
  cash: { icon: 'cash', color: '#FA8C16' },
  other: { icon: 'ellipsis-horizontal-circle', color: '#8C8C8C' },
};

// 如果有自定义图片，优先使用图片
const CUSTOM_IMAGES = {
  // wechat: require('../../assets/icons/wechat.png'),
  // alipay: require('../../assets/icons/alipay.png'),
  // bank: require('../../assets/icons/bank.png'),
  // cash: require('../../assets/icons/cash.png'),
};

// 新拟物：图标方块与背景同色系（凸起），仅图标本身带账户色
export const AccountIcon = memo(function AccountIcon({ type, size = 42, icon, color }) {
  const neu = useNeu();
  const config = ACCOUNT_ICONS[type] || ACCOUNT_ICONS.other;
  const hasCustomImage = CUSTOM_IMAGES[type];

  const iconColor = color || config.color;
  const iconSize = Math.round(size * 0.5);

  return (
    <View style={[styles.container, neu.raisedSm, { width: size, height: size, borderRadius: size * 0.3 }]}>
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

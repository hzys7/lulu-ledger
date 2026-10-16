// 小璐记账 · 账户图标组件（支持自定义图片）
import React, { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

// 账户图标：柔和的彩色圆角底（Stripe 的 icon tint 手法）
function tintBg(hex, alpha = '1F') {
  if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'transparent';
  return hex + alpha;
}

export const AccountIcon = memo(function AccountIcon({ type, size = 42, icon, color }) {
  const config = ACCOUNT_ICONS[type] || ACCOUNT_ICONS.other;
  const hasCustomImage = CUSTOM_IMAGES[type];

  const iconColor = color || config.color;
  const iconSize = Math.round(size * 0.5);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tintBg(iconColor) }]}>
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

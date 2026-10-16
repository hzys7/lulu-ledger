import React, { memo } from 'react';
import { useThemeColors } from '../hooks/useThemeColors';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ICONS = {
  '餐饮': 'restaurant',
  '交通': 'car',
  '购物': 'cart',
  '娱乐': 'game-controller',
  '住房': 'home',
  '医疗': 'medical',
  '教育': 'school',
  '通讯': 'phone-portrait',
  '服饰': 'shirt',
  '日用': 'basket',
  '社交': 'people',
  '其他支出': 'ellipsis-horizontal',
  '工资': 'cash',
  '奖金': 'trophy',
  '投资': 'trending-up',
  '兼职': 'briefcase',
  '红包': 'gift',
  '其他收入': 'add-circle',
};

// 分类图标：柔和的彩色圆角底（Stripe 的 icon tint 手法）
function tintBg(hex, alpha = '1F') {
  if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'transparent';
  return hex + alpha;
}

export const CategoryIcon = memo(function CategoryIcon({ category, size = 40, type = 'expense' }) {
  const tc = useThemeColors();
  const tint = (tc.categories && tc.categories[category]) || (type === 'income' ? tc.success : tc.textSubtle);
  const radius = Math.round(size * 0.3);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: tintBg(tint),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name={ICONS[category] || 'pricetag'}
        size={Math.round(size * 0.5)}
        color={tint}
      />
    </View>
  );
});

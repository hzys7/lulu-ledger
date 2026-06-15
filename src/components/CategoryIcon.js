import React from 'react';
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

function withAlpha(hex, alpha) {
  if (!hex) return hex;
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

export function CategoryIcon({ category, size = 40, type = 'expense' }) {
  const tc = useThemeColors();
  const tint = (tc.categories && tc.categories[category]) || (type === 'income' ? tc.success : tc.textSubtle);
  const radius = Math.round(size * 0.32);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: withAlpha(tint, 0.12),
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
}

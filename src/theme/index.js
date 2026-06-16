// 璐璐记账 - 设计系统
// 风格：现代极简 · 干净克制 · 高级灰
// 原则：单一品牌强调色 + 中性灰阶 + 大量留白 + 细腻字间距

export const colors = {
  // 品牌强调色（仅用于 CTA / 进度 / 选中态）
  primary: '#111827',          // 近黑 - 主色（按钮、强调文字、tabBar 选中）
  primaryHover: '#1F2937',
  primarySubtle: '#F3F4F6',
  primaryOn: '#FFFFFF',

  // 品牌辅色（仅用于品牌身份点，如 logo / splash）
  accent: '#7C5CFF',
  accentSubtle: '#F1ECFF',

  // 功能色
  success: '#059669',
  successSubtle: '#ECFDF5',
  danger: '#DC2626',
  dangerSubtle: '#FEF2F2',
  warning: '#D97706',
  warningSubtle: '#FFFBEB',
  info: '#2563EB',
  infoSubtle: '#EFF6FF',

  // 8 色克制分类色板（用于图表 / 分类）
  palette: [
    '#111827',
    '#7C5CFF',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#EC4899',
    '#0EA5E9',
    '#64748B',
  ],

  // 分类颜色
  categories: {
    '餐饮': '#F97316',
    '交通': '#3B82F6',
    '购物': '#EC4899',
    '娱乐': '#F59E0B',
    '住房': '#111827',
    '医疗': '#10B981',
    '教育': '#7C5CFF',
    '通讯': '#8B5CF6',
    '服饰': '#F472B6',
    '日用': '#0EA5E9',
    '社交': '#F87171',
    '其他支出': '#64748B',
    '工资': '#10B981',
    '奖金': '#F59E0B',
    '投资': '#111827',
    '兼职': '#3B82F6',
    '红包': '#EF4444',
    '其他收入': '#64748B',
    '零食': '#FB923C',
    '水果': '#84CC16',
    '饮品': '#A78BFA',
    '美妆': '#F0ABFC',
    '居家': '#64748B',
    '宠物': '#FBBF24',
    '旅行': '#06B6D4',
    '数码': '#1E293B',
    '运动': '#22C55E',
    '充值': '#0EA5E9',
    '礼物': '#F43F5E',
    '退款': '#94A3B8',
    '报销': '#10B981',
    '利息': '#F59E0B',
    '理财收益': '#7C5CFF',
  },

  // 中性色（9 级灰阶）
  background: '#F0F1F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F4F5',
  surfaceSubtle: '#F9FAFB',
  surfaceSection: '#F4F5F8',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  border: '#E5E7EB',
  borderStrong: '#D4D4D8',
  divider: '#F1F5F9',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.45)',
  shadow: 'rgba(15, 23, 42, 0.06)',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  xxl: 28,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  display: 44,
};

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 8,
  },
};

export const darkColors = {
  primary: '#F8FAFC',
  primaryHover: '#E2E8F0',
  primarySubtle: '#1F2937',
  primaryOn: '#0B0B12',

  accent: '#A78BFA',
  accentSubtle: '#1E1B4B',

  success: '#34D399',
  successSubtle: '#064E3B',
  danger: '#F87171',
  dangerSubtle: '#450A0A',
  warning: '#FBBF24',
  warningSubtle: '#451A03',
  info: '#60A5FA',
  infoSubtle: '#1E3A5F',
  palette: [
    '#F8FAFC',
    '#A78BFA',
    '#34D399',
    '#FBBF24',
    '#F87171',
    '#F472B6',
    '#38BDF8',
    '#94A3B8',
  ],
  categories: {
    '餐饮': '#FB923C',
    '交通': '#60A5FA',
    '购物': '#F472B6',
    '娱乐': '#FBBF24',
    '住房': '#F8FAFC',
    '医疗': '#34D399',
    '教育': '#A78BFA',
    '通讯': '#C4B5FD',
    '服饰': '#F472B6',
    '日用': '#38BDF8',
    '社交': '#F87171',
    '其他支出': '#94A3B8',
    '工资': '#34D399',
    '奖金': '#FBBF24',
    '投资': '#F8FAFC',
    '兼职': '#60A5FA',
    '红包': '#F87171',
    '其他收入': '#94A3B8',
    '零食': '#FB923C',
    '水果': '#A3E635',
    '饮品': '#C4B5FD',
    '美妆': '#F5D0FE',
    '居家': '#94A3B8',
    '宠物': '#FCD34D',
    '旅行': '#22D3EE',
    '数码': '#94A3B8',
    '运动': '#4ADE80',
    '充值': '#38BDF8',
    '礼物': '#FB7185',
    '退款': '#CBD5E1',
    '报销': '#34D399',
    '利息': '#FBBF24',
    '理财收益': '#A78BFA',
  },
  // 背景用近黑(非纯黑),文字用近白(非纯白) - 降低 OLED 刺眼感
  background: '#0A0A0F',
  surface: '#16161F',
  surfaceMuted: '#1E1E29',
  surfaceSubtle: '#0F0F18',
  surfaceSection: '#101019',
  text: '#E5E7EB',
  textSecondary: '#B7BCC8',
  textMuted: '#8B8F9A',
  textSubtle: '#5C6070',
  border: '#23232F',
  borderStrong: '#2E2E3D',
  divider: '#1A1A24',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

export function getThemeColors(theme = 'light') {
  return theme === 'dark' ? darkColors : colors;
}

export const categories = {
  expense: [
    { name: '餐饮', icon: 'restaurant' },
    { name: '零食', icon: 'pizza' },
    { name: '水果', icon: 'nutrition' },
    { name: '饮品', icon: 'cafe' },
    { name: '交通', icon: 'car' },
    { name: '购物', icon: 'cart' },
    { name: '服饰', icon: 'shirt' },
    { name: '美妆', icon: 'sparkles' },
    { name: '日用', icon: 'basket' },
    { name: '居家', icon: 'home' },
    { name: '住房', icon: 'business' },
    { name: '通讯', icon: 'phone-portrait' },
    { name: '医疗', icon: 'medical' },
    { name: '教育', icon: 'school' },
    { name: '娱乐', icon: 'game-controller' },
    { name: '旅行', icon: 'airplane' },
    { name: '运动', icon: 'fitness' },
    { name: '数码', icon: 'laptop' },
    { name: '宠物', icon: 'paw' },
    { name: '充值', icon: 'card' },
    { name: '礼物', icon: 'gift' },
    { name: '其他支出', icon: 'ellipsis-horizontal' },
  ],
  income: [
    { name: '工资', icon: 'cash' },
    { name: '奖金', icon: 'trophy' },
    { name: '投资', icon: 'trending-up' },
    { name: '兼职', icon: 'briefcase' },
    { name: '红包', icon: 'gift' },
    { name: '退款', icon: 'refresh' },
    { name: '报销', icon: 'receipt' },
    { name: '利息', icon: 'wallet' },
    { name: '理财收益', icon: 'stats-chart' },
    { name: '其他收入', icon: 'add-circle' },
  ],
};

// 小璐记账 - 设计系统
// 风格：Stripe 风格（金融科技 · 精密专业）
// 原则：浅蓝灰背景 #F6F9FC + 白色卡片 + 1px 细边框 + 多层精致阴影
//       深蓝标题 #0A2540 保证数字可读性，Stripe 紫 #635BFF 作为唯一品牌强调色
// 说明：React Native 只能渲染单层阴影，这里用「1px 边框 + 向下柔和投影」
//       近似 Stripe 的 border + 多层阴影，边框才是卡片边界感的主要来源。

export const colors = {
  // 品牌主色（CTA / 进度 / 选中态）
  primary: '#635BFF',          // Stripe 紫
  primaryHover: '#5851EA',
  primarySubtle: '#F0EFFF',
  primaryOn: '#FFFFFF',

  // 品牌辅色（Stripe 青）
  accent: '#0EA5C4',
  accentSubtle: '#E5F7FA',

  // 功能色
  success: '#1EA672',
  successSubtle: '#E7F6EF',
  danger: '#DF1B41',
  dangerSubtle: '#FDEDF0',
  warning: '#C77700',
  warningSubtle: '#FDF4E6',
  info: '#3B82F6',
  infoSubtle: '#EBF2FE',

  // 8 色克制色板（图表 / 分类）
  palette: [
    '#635BFF',
    '#0EA5C4',
    '#3B82F6',
    '#1EA672',
    '#C77700',
    '#DF1B41',
    '#A78BFA',
    '#8792A2',
  ],

  // 分类颜色（低饱和，保持专业克制）
  categories: {
    '餐饮': '#E5A05F',
    '交通': '#6F9BE0',
    '购物': '#E08BAE',
    '娱乐': '#D8AC55',
    '住房': '#8E97A5',
    '医疗': '#5FB894',
    '教育': '#8C7DF2',
    '通讯': '#9C8CE8',
    '服饰': '#E299C0',
    '日用': '#64A8D8',
    '社交': '#E5847E',
    '其他支出': '#9AA3B0',
    '工资': '#4FAE7E',
    '奖金': '#D8AC55',
    '投资': '#8E97A5',
    '兼职': '#6F9BE0',
    '红包': '#E5847E',
    '其他收入': '#9AA3B0',
    '零食': '#E5A977',
    '水果': '#8FBE63',
    '饮品': '#A79BE8',
    '美妆': '#E29CD4',
    '居家': '#9AA3B0',
    '宠物': '#D9B865',
    '旅行': '#5BBFC9',
    '数码': '#7E8899',
    '运动': '#5FBE7E',
    '充值': '#64A8D8',
    '礼物': '#E58398',
    '退款': '#A8B0BD',
    '报销': '#4FAE7E',
    '利息': '#D8AC55',
    '理财收益': '#8C7DF2',
  },

  // 中性色 —— 浅蓝灰底 + 白卡
  background: '#F6F9FC',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  surfaceSubtle: '#E9EEF4',
  surfaceSection: '#F6F9FC',
  card: '#FFFFFF',
  cardSubtle: '#FAFBFD',
  text: '#0A2540',
  textSecondary: '#425466',
  textMuted: '#697386',
  textSubtle: '#8792A2',
  border: '#E6EBF1',
  borderStrong: '#D8E0E9',
  divider: '#EDF1F6',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(10, 37, 64, 0.4)',
  shadow: 'rgba(10, 37, 64, 0.08)',
  shadowInk: '#0A2540',        // 阴影颜色（RN 单层阴影用）

  // 专用色
  pageBg: '#F6F9FC',
  starColor: '#635BFF',
  starColorLight: '#C7C4FF',
  chipBg: '#FFFFFF',
  badgeBg: '#F0EFFF',
  iconBg: '#F0EFFF',
  iconBgAlt: '#E5F7FA',
  iconBgDanger: '#FDEDF0',
  iconBgWarning: '#FDF4E6',
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

// Stripe 风格：中等圆角（rounded-lg / xl），禁止过大圆角
export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
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

// ── 表面样式助手 ──────────────────────────────────────
// Stripe 风格：白卡 + 1px 细边框 + 向下柔和投影。
// 卡片边界主要靠边框（RN 单层阴影无法复刻 Stripe 的多层阴影）。
export function neuStyles(tc) {
  const card = tc.card || '#FFFFFF';
  const well = tc.surfaceSubtle || '#E9EEF4';
  const border = tc.border || '#E6EBF1';
  const ink = tc.shadowInk || '#0A2540';

  const cast = (elevation, offsetY, radius, opacity) => ({
    shadowColor: ink,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  });

  return {
    // 卡片（默认 / 小 / 大）
    raised: { backgroundColor: card, borderWidth: 1, borderColor: border, ...cast(2, 2, 8, 0.06) },
    raisedSm: { backgroundColor: card, borderWidth: 1, borderColor: border, ...cast(1, 1, 4, 0.05) },
    raisedLg: { backgroundColor: card, borderWidth: 1, borderColor: border, ...cast(4, 6, 18, 0.1) },
    // 输入框 / 内嵌区：浅灰底 + 1px 边框
    inset: { backgroundColor: well, borderWidth: 1, borderColor: border, shadowOpacity: 0, elevation: 0 },
    // 按下态
    pressed: { backgroundColor: well, borderWidth: 1, borderColor: border, shadowOpacity: 0, elevation: 0 },
  };
}

export const darkColors = {
  primary: '#7A73FF',
  primaryHover: '#8F89FF',
  primarySubtle: '#1E2A5E',
  primaryOn: '#0A1F33',

  accent: '#4DD8F0',
  accentSubtle: '#0C3540',

  success: '#4ADE9B',
  successSubtle: '#0D3A2A',
  danger: '#FF8095',
  dangerSubtle: '#3D1620',
  warning: '#F5B445',
  warningSubtle: '#3D2E12',
  info: '#78B0FF',
  infoSubtle: '#12314F',

  palette: [
    '#8E88FF',
    '#4DD8F0',
    '#78B0FF',
    '#4ADE9B',
    '#F5C661',
    '#FF8095',
    '#B9A4FF',
    '#A8B6C6',
  ],

  categories: {
    '餐饮': '#E5A05F',
    '交通': '#7FA8F5',
    '购物': '#E08BAE',
    '娱乐': '#E0B95A',
    '住房': '#98A0AE',
    '医疗': '#5FB894',
    '教育': '#9D91FF',
    '通讯': '#B7A9F5',
    '服饰': '#E299C0',
    '日用': '#7FBBE5',
    '社交': '#F08A84',
    '其他支出': '#98A0AE',
    '工资': '#4CC38A',
    '奖金': '#E0B95A',
    '投资': '#98A0AE',
    '兼职': '#7FA8F5',
    '红包': '#F08A84',
    '其他收入': '#98A0AE',
    '零食': '#E5A977',
    '水果': '#A3CF74',
    '饮品': '#B7A9F5',
    '美妆': '#E8A8DA',
    '居家': '#98A0AE',
    '宠物': '#E0C377',
    '旅行': '#5BBFC9',
    '数码': '#98A0AE',
    '运动': '#63C784',
    '充值': '#7FBBE5',
    '礼物': '#F0899C',
    '退款': '#A8B0BD',
    '报销': '#4CC38A',
    '利息': '#E0B95A',
    '理财收益': '#9D91FF',
  },

  // Stripe 深蓝系暗色
  background: '#082032',
  surface: '#0E2E4A',
  surfaceMuted: '#0B2438',
  surfaceSubtle: '#0A2135',
  surfaceSection: '#082032',
  card: '#0E2E4A',
  cardSubtle: '#123454',
  text: '#E8EEF5',
  textSecondary: '#C0CEDC',
  textMuted: '#93A8BE',
  textSubtle: '#6E869D',
  border: '#1C3C5A',
  borderStrong: '#25496B',
  divider: '#14324D',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: 'rgba(0, 0, 0, 0.5)',
  shadowInk: '#000000',

  pageBg: '#082032',
  starColor: '#9F9AFF',
  starColorLight: '#4B48A8',
  chipBg: '#0E2E4A',
  badgeBg: '#1E2A5E',
  iconBg: '#1E2A5E',
  iconBgAlt: '#0C3540',
  iconBgDanger: '#3D1620',
  iconBgWarning: '#3D2E12',
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

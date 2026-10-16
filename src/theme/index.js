// 小璐记账 - 设计系统
// 风格：Neumorphism / 新拟物派（Soft UI）
// 原则：浅灰单色背景 + 同色系元素 + 双光源柔和阴影 + 大圆角 + 低对比
// 说明：React Native 不支持 CSS 的双重阴影与 inset 阴影，
//       这里用「1px 同色系斜角(border bevel) + 单向柔和投影」近似模拟
//       左上亮 / 右下暗 的固定光源，交互元素按下时由凸起转为凹陷。

// ── 新拟物光源常量（浅色基准）─────────────────────────
// 具体值随主题走 colors/darkColors 上的
// neuBase / neuLight / neuDark / neuInset / neuEdge / neuHighlight

export const colors = {
  // 品牌主色（CTA / 进度 / 选中态）
  primary: '#6D5DFC',          // 紫 - 主色（新拟物强调色）
  primaryHover: '#5A48E8',
  primarySubtle: '#E3E0FB',
  primaryOn: '#FFFFFF',

  // 品牌辅色（用于次要操作 / 辅助标识）
  accent: '#4ECDC4',           // 青 - 辅色
  accentSubtle: '#DCF2F0',

  // 功能色（整体降饱和，贴合柔和气质）
  success: '#2E9E6B',
  successSubtle: '#DCEFE4',
  danger: '#E5675F',
  dangerSubtle: '#F7E1DF',
  warning: '#C99A2E',
  warningSubtle: '#F5EBD5',
  info: '#5B8DEF',
  infoSubtle: '#DFE8FA',

  // 8 色克制分类色板（用于图表 / 分类）
  palette: [
    '#6D5DFC',
    '#4ECDC4',
    '#5B8DEF',
    '#E5A9A3',
    '#C99A2E',
    '#A78BFA',
    '#8E97A5',
    '#2E9E6B',
  ],

  // 分类颜色（低饱和，避免破坏柔和立体感）
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

  // 中性色 —— 与背景同色系
  background: '#E0E5EC',
  surface: '#E0E5EC',
  surfaceMuted: '#D7DDE7',
  surfaceSubtle: '#CFD6E1',
  surfaceSection: '#E0E5EC',
  card: '#E0E5EC',
  cardSubtle: '#E4E8EF',
  text: '#333A45',
  textSecondary: '#525A66',
  textMuted: '#6B7280',
  textSubtle: '#7C8593',
  border: 'rgba(184, 188, 194, 0.6)',
  borderStrong: '#B8BCC2',
  divider: 'rgba(184, 188, 194, 0.5)',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(51, 58, 69, 0.35)',
  shadow: 'rgba(184, 188, 194, 0.75)',

  // 新拟物专用 token
  neuBase: '#E0E5EC',
  neuLight: '#FFFFFF',
  neuDark: '#B8BCC2',
  neuInset: '#DDE3EA',
  neuEdge: '#D2D7DE',                     // 凹陷侧边（几乎与背景同色，避免描边感）
  neuHighlight: 'rgba(255, 255, 255, 0.85)', // 左上高光

  // 专用色（柔和同色系浅色调）
  pageBg: '#E0E5EC',
  starColor: '#8B7DFF',
  starColorLight: '#B9B0F5',
  chipBg: '#E0E5EC',
  badgeBg: '#E3E0FB',
  iconBg: '#E3E0FB',
  iconBgAlt: '#DCF2F0',
  iconBgDanger: '#F7E1DF',
  iconBgWarning: '#F5EBD5',
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

// 新拟物要求柔和一致的曲率，整体比扁平风格更大
export const borderRadius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 26,
  xxl: 30,
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

// ── 新拟物样式助手 ────────────────────────────────────
// RN 不支持 CSS 的双阴影 / inset 阴影，这里的近似策略：
//   凸起 raised : 只在左上保留一道极淡高光，右下**不画暗色描边**，
//                 改用右下方向的柔和投影让卡片"离开"背景（消除线框感）
//   凹陷 inset  : 左上压暗 + 右下提亮，配合更深的底色表现"压进去"
export function neuStyles(tc) {
  const highlight = tc.neuHighlight || tc.neuLight || '#FFFFFF';
  const edge = tc.neuEdge || tc.neuDark || '#B8BCC2';
  const dark = tc.neuDark || '#B8BCC2';
  const base = tc.neuBase || tc.surface;
  const insetBg = tc.neuInset || tc.surfaceSubtle;

  // 仅左上高光，显式关闭右下边框避免残留描边
  const topLeftHighlight = {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: highlight,
    borderLeftColor: highlight,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  };

  const cast = (offset, radius, elevation, opacity) => ({
    shadowColor: dark,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  });

  const recessed = {
    backgroundColor: insetBg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: edge,
    borderLeftColor: edge,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: highlight,
    borderRightColor: highlight,
    shadowOpacity: 0,
    elevation: 0,
  };

  return {
    // 凸起（卡片 / 按钮默认态）
    raised: { backgroundColor: base, ...topLeftHighlight, ...cast(4, 16, 8, 0.5) },
    raisedSm: { backgroundColor: base, ...topLeftHighlight, ...cast(3, 10, 5, 0.45) },
    raisedLg: { backgroundColor: base, ...topLeftHighlight, ...cast(6, 22, 12, 0.5) },
    // 凹陷（输入框 / 按下态 / 内嵌区）
    inset: { ...recessed },
    pressed: { ...recessed },
  };
}

export const darkColors = {
  primary: '#8B7DFF',
  primaryHover: '#9D91FF',
  primarySubtle: '#322C55',
  primaryOn: '#13141A',

  accent: '#4ECDC4',
  accentSubtle: '#1E3B39',

  success: '#4CC38A',
  successSubtle: '#1E3A2E',
  danger: '#F0837C',
  dangerSubtle: '#3C2422',
  warning: '#E0B95A',
  warningSubtle: '#3A3320',
  info: '#7FA8F5',
  infoSubtle: '#233250',

  palette: [
    '#8B7DFF',
    '#4ECDC4',
    '#7FA8F5',
    '#E5A9A3',
    '#E0B95A',
    '#C4B5FD',
    '#98A0AE',
    '#4CC38A',
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

  background: '#2A2D35',
  surface: '#2A2D35',
  surfaceMuted: '#23262E',
  surfaceSubtle: '#1F2229',
  surfaceSection: '#2A2D35',
  card: '#2A2D35',
  cardSubtle: '#2E323B',
  text: '#E4E7EC',
  textSecondary: '#C2C8D2',
  textMuted: '#98A0AE',
  textSubtle: '#8A92A0',
  border: 'rgba(0, 0, 0, 0.45)',
  borderStrong: '#3C414C',
  divider: 'rgba(0, 0, 0, 0.35)',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: 'rgba(0, 0, 0, 0.55)',

  neuBase: '#2A2D35',
  neuLight: '#33373F',
  neuDark: '#212429',
  neuInset: '#252830',
  neuEdge: '#24272E',
  neuHighlight: '#33373F',

  pageBg: '#2A2D35',
  starColor: '#A79BFF',
  starColorLight: '#6E63C9',
  chipBg: '#2A2D35',
  badgeBg: '#322C55',
  iconBg: '#322C55',
  iconBgAlt: '#1E3B39',
  iconBgDanger: '#3C2422',
  iconBgWarning: '#3A3320',
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

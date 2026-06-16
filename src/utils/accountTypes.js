// 账户类型定义 - 统一管理
export const ACCOUNT_TYPES = [
  { key: 'wechat', name: '微信', icon: 'logo-wechat', color: '#07C160' },
  { key: 'alipay', name: '支付宝', icon: 'wallet', color: '#1677FF' },
  { key: 'bank', name: '银行卡', icon: 'card', color: '#722ED1' },
  { key: 'cash', name: '现金', icon: 'cash', color: '#FA8C16' },
  { key: 'other', name: '其他', icon: 'ellipsis-horizontal-circle', color: '#8C8C8C' },
];

export function typeInfo(type) {
  return ACCOUNT_TYPES.find(t => t.key === type) || ACCOUNT_TYPES[4];
}

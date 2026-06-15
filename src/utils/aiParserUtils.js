// 璐璐记账 · AI 解析工具函数（纯 JS，无外部依赖）
// 和 aiParser.js 分开以便在 Node 中做单元测试

// 从 AI 原始输出中提取所有顶层 JSON 对象。
// 1) 如果包了 ```json ... ``` 代码块，只取代码块内容；
// 2) 否则按大括号配对从左到右扫描；
// 3) 只取「对象」类型 [{...}]，跳过裸数组；
// 4) 字符串内的大括号不会破坏配对。
export function extractAllJsonObjects(content) {
  let text = String(content || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const results = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch !== '{') { i++; continue; }
    let depth = 0;
    let inStr = false;
    let escape = false;
    let start = -1;
    for (let j = i; j < n; j++) {
      const c = text[j];
      if (inStr) {
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') { inStr = false; }
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '{') { if (depth === 0) start = j; depth++; continue; }
      if (c === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          results.push(text.substring(start, j + 1));
          i = j + 1;
          start = -1;
          break;
        }
      }
    }
    if (start === -1) { i++; }
  }
  return results;
}

// 分类别名映射：AI 偶尔会返回列表外的词，模糊匹配到最接近的分类
const CATEGORY_ALIASES = {
  '吃饭': '餐饮', '餐': '餐饮', '吃': '餐饮', '外卖': '餐饮', '喝奶茶': '饮品', '咖啡': '饮品',
  '奶茶': '饮品', '水': '饮品', '饮料': '饮品',
  '公交': '交通', '地铁': '交通', '高铁': '交通', '火车': '交通', '油费': '交通', '停车': '交通',
  '买衣服': '服饰', '鞋子': '服饰',
  '零食': '零食', '小吃': '零食',
  '超市': '购物', '网购': '购物',
  '话费': '充值', '网费': '充值', '水电': '充值', '电费': '充值', '水费': '充值',
  '看病': '医疗', '药': '医疗',
  '培训': '教育', '书': '教育', '课程': '教育',
  '电影': '娱乐', '游戏': '娱乐', '唱歌': '娱乐', 'ktv': '娱乐',
  '出差': '旅行', '旅游': '旅行',
  '运动': '运动', '健身': '运动', '瑜伽': '运动',
  '返现': '退款', '退货': '退款',
  '兼职': '兼职', '副业': '兼职',
  '理财': '理财收益', '余额宝': '理财收益',
};

const VALID_EXPENSE = ['餐饮','零食','水果','饮品','交通','购物','服饰','美妆','日用','居家','住房','通讯','医疗','教育','娱乐','旅行','运动','数码','宠物','充值','礼物','其他支出'];
const VALID_INCOME = ['工资','奖金','投资','兼职','红包','退款','报销','利息','理财收益','其他收入'];

function resolveCategory(name, type) {
  if (!name) return type === 'expense' ? '其他支出' : '其他收入';
  if (type === 'expense' && VALID_EXPENSE.includes(name)) return name;
  if (type === 'income' && VALID_INCOME.includes(name)) return name;
  // 别名模糊匹配
  const alias = CATEGORY_ALIASES[name];
  if (alias) return alias;
  // 子串匹配：找列表里包含 name 的
  const list = type === 'expense' ? VALID_EXPENSE : VALID_INCOME;
  for (const cat of list) {
    if (cat.includes(name) || name.includes(cat)) return cat;
  }
  return type === 'expense' ? '其他支出' : '其他收入';
}

export function validateParsed(p) {
  if (!p || typeof p !== 'object') return { ok: false, error: 'AI 返回格式错误' };
  // 金额：容忍字符串（AI 有时给 "35" 而不是 35）
  let amount = p.amount;
  if (typeof amount === 'string') amount = parseFloat(amount);
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return { ok: false, error: '金额无效（AI 返回 "' + p.amount + '"）' };
  p.amount = amount;
  if (p.type !== 'expense' && p.type !== 'income') return { ok: false, error: '类型无效（必须是支出/收入）' };
  // 分类：模糊匹配
  p.category = resolveCategory(typeof p.category === 'string' ? p.category : '', p.type);
  // 日期：容错，无法解析则用现在
  if (typeof p.date !== 'string' || isNaN(Date.parse(p.date))) {
    p.date = new Date().toISOString();
  }
  if (typeof p.note !== 'string') p.note = '';
  if (p.note.length > 30) p.note = p.note.substring(0, 30);
  return { ok: true };
}

// CommonJS shim for Node unit tests
if (typeof module !== 'undefined') {
  module.exports = { extractAllJsonObjects, validateParsed };
}

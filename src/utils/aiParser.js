// 璐璐记账 · AI 解析（自然语言 → 账目 JSON）
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';

const SYSTEM_PROMPT = `你是一个记账助手。用户会用自然语言描述一笔消费或收入，你需要严格解析成 JSON。

当前日期基准：{NOW}
货币：{CURRENCY}

支持的支出分类：餐饮、零食、水果、饮品、交通、购物、服饰、美妆、日用、居家、住房、通讯、医疗、教育、娱乐、旅行、运动、数码、宠物、充值、礼物、其他支出
支持的收入分类：工资、奖金、投资、兼职、红包、退款、报销、利息、理财收益、其他收入

输出要求：
- 仅输出 JSON，不要任何其他文字、markdown 标记、解释
- 严格遵守以下结构：
{
  "amount": 数字（必填，正数）,
  "type": "expense" | "income"（必填）,
  "category": "从上述分类里选最匹配的一个"（必填）,
  "date": "ISO 8601 格式 YYYY-MM-DDTHH:mm:ss.sssZ"（必填，UTC）,
  "note": "简短中文描述"（必填，不超过 20 字）
}

规则：
- 默认 type 为 expense，除非用户明确说"收/赚/入账/工资/收入"等
- 数字直接用阿拉伯数字，不要带"￥"或"元"等
- 相对时间（昨天/今天/前天/上周 X/3 天前）以"当前日期基准"为参照
- 默认时间为该天的 12:00:00
- 分类严格从列表里选，不在列表里用"其他支出"或"其他收入"
- note 简洁，例如"打车"、"午餐"、"工资"`;

function buildSystemPrompt() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  const timeStr = now.toTimeString().slice(0, 5);
  return SYSTEM_PROMPT
    .replace('{NOW}', dateStr + ' 周' + weekDay + ' ' + timeStr)
    .replace('{CURRENCY}', 'CNY');
}

// 从 AI 原始输出中提取所有顶层 JSON 对象。
// 1) 如果包了 ```json ... ``` 代码块，只取代码块内容；
// 2) 否则按大括号配对从左到右扫描；
// 3) 只取「对象」类型 [{...}]，跳过裸数组；
// 4) 字符串内的大括号不会破坏配对。
function extractAllJsonObjects(content) {
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
// 调 AI 解析文本，返回 { ok, data?, error? }
// data = { amount, type, category, date, note }
export async function parseTransactionFromText(userText) {
  const config = await loadAiConfig();
  if (!config.apiKey) {
    return { ok: false, error: '未配置 API Key，请先在设置 → AI 配置中填写' };
  }
  if (!config.enabled) {
    return { ok: false, error: 'AI 功能未启用，请在设置 → AI 配置中打开开关' };
  }
  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) {
    return { ok: false, error: '接口地址未配置' };
  }
  const model = config.model === '__custom__' ? config.customModel : config.model;
  if (!model) {
    return { ok: false, error: '模型未配置' };
  }
  try {
    const url = baseURL + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userText },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效（401）' };
      if (res.status === 402) return { ok: false, error: '余额不足（402）' };
      if (res.status === 429) return { ok: false, error: '请求过快（429）' };
      return { ok: false, error: 'HTTP ' + res.status + (errText ? '：' + errText.substring(0, 100) : '') };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: 'AI 返回内容为空' };
    }
    // 1) 优先匹配 ```json ... ``` 代码块
    // 2) 否则用括号配对，从左到右提取第一段合法 JSON
    // 3) 支持多笔账目：AI 可能返回 {...} {...}（中间有逗号/换行）
    const objs = extractAllJsonObjects(content);
    if (objs.length === 0) {
      return { ok: false, error: 'AI 返回的不是 JSON：' + content.substring(0, 100) };
    }
    const items = [];
    let lastErr = '';
    for (const raw of objs) {
      // 去掉尾随逗号（容错）
      const cleaned = raw.replace(/,(\s*[\}\]])/g, '$1');
      try {
        const obj = JSON.parse(cleaned);
        const valid = validateParsed(obj);
        if (valid.ok) {
          items.push(obj);
        } else {
          lastErr = valid.error;
        }
      } catch (e) {
        lastErr = e.message;
      }
    }
    if (items.length === 0) {
      return { ok: false, error: 'JSON 解析失败：' + (lastErr || '内容不合法') };
    }
    if (items.length === 1) {
      return { ok: true, data: items[0] };
    }
    return { ok: true, data: items, multiple: true };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 100) };
  }
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

function validateParsed(p) {
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
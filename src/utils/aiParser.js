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
    // 提取 JSON：有时 AI 会包 ```json ``` 标记
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: 'AI 返回的不是 JSON：' + content.substring(0, 100) };
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { ok: false, error: 'JSON 解析失败：' + e.message };
    }
    // 校验字段
    const valid = validateParsed(parsed);
    if (!valid.ok) return valid;
    return { ok: true, data: parsed };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 100) };
  }
}

function validateParsed(p) {
  if (!p || typeof p !== 'object') return { ok: false, error: 'AI 返回格式错误' };
  if (typeof p.amount !== 'number' || p.amount <= 0) return { ok: false, error: '金额无效' };
  if (p.type !== 'expense' && p.type !== 'income') return { ok: false, error: '类型无效（必须是支出/收入）' };
  if (typeof p.category !== 'string' || !p.category) return { ok: false, error: '分类缺失' };
  if (typeof p.date !== 'string' || isNaN(Date.parse(p.date))) return { ok: false, error: '日期格式错误' };
  if (typeof p.note !== 'string') p.note = '';
  if (p.note.length > 30) p.note = p.note.substring(0, 30);
  return { ok: true };
}
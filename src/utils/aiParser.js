// 小璐记账 · AI 解析（自然语言 → 账目 JSON）
import { callAiApi } from './aiClient';
import { buildCorrectionExamples } from './aiCorrections';
import { extractAllJsonObjects, validateParsed } from './aiParserUtils';

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
- 日期中的时间部分用当前 UTC 时刻，不要用 00:00 或 12:00
- 分类严格从列表里选，不在列表里用"其他支出"或"其他收入"
- note 简洁，例如"打车"、"午餐"、"工资"`;

async function buildSystemPrompt() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  const timeStr = now.toTimeString().slice(0, 5);
  let prompt = SYSTEM_PROMPT
    .replace('{NOW}', dateStr + ' 周' + weekDay + ' ' + timeStr)
    .replace('{CURRENCY}', 'CNY');
  // 追加用户分类纠正偏好
  const corrections = await buildCorrectionExamples();
  if (corrections) {
    prompt += corrections;
  }
  return prompt;
}

// 调 AI 解析文本，返回 { ok, data?, error? }
// data = { amount, type, category, date, note }

export async function parseTransactionFromText(userText) {
  const systemPrompt = await buildSystemPrompt();
  const result = await callAiApi({
    system: systemPrompt,
    userMessage: userText,
    temperature: 0.1,
    maxTokens: 300,
  });

  if (!result.ok) {
    // 保留友好的提示文案
    const err = result.error || '';
    if (err.includes('API Key')) return { ok: false, error: '未配置 API Key，请先在设置 → AI 配置中填写' };
    if (err.includes('未启用')) return { ok: false, error: 'AI 功能未启用，请在设置 → AI 配置中打开开关' };
    return { ok: false, error: err };
  }

  try {
    const content = result.content;
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
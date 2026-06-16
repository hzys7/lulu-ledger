// 小璐记账 · 统一 AI API 客户端
// 封装 OpenAI 兼容的 chat/completions 调用、配置校验、错误处理。
// 所有 AI 模块统一走这里，消除 6 个文件中的重复 fetch 代码。
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';

/**
 * 调用 AI chat/completions API。
 *
 * @param {Object} options
 * @param {string} [options.system] - System prompt（与 messages 二选一）
 * @param {Array}  [options.messages] - 完整消息数组 [{role, content}]（与 system 二选一）
 * @param {string} options.userMessage - 用户消息（与 messages 二选一）
 * @param {number} [options.temperature=0.5]
 * @param {number} [options.maxTokens=500]
 * @returns {Promise<{ ok: true, content: string } | { ok: false, error: string }>}
 */
export async function callAiApi({ system, messages, userMessage, temperature, maxTokens }) {
  const config = await loadAiConfig();
  if (!config.apiKey) return { ok: false, error: '未配置 API Key' };
  if (!config.enabled) return { ok: false, error: 'AI 功能未启用' };

  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) return { ok: false, error: '接口地址未配置' };

  const model = config.model === '__custom__' ? config.customModel : config.model;
  if (!model) return { ok: false, error: '模型未配置' };

  // 构建消息列表：优先用完整 messages 数组，否则组装 system + userMessage
  const msgList = messages || [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...(userMessage ? [{ role: 'user', content: userMessage }] : []),
  ];
  if (msgList.length === 0) return { ok: false, error: '消息内容为空' };

  try {
    const res = await fetch(baseURL + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: msgList,
        temperature: temperature ?? 0.5,
        max_tokens: maxTokens ?? 500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效（401）' };
      if (res.status === 402) return { ok: false, error: '余额不足（402）' };
      if (res.status === 403) return { ok: false, error: 'API Key 无权限（403）' };
      if (res.status === 404) return { ok: false, error: '接口地址不正确（404）' };
      if (res.status === 429) return { ok: false, error: '请求过快（429）' };
      return { ok: false, error: 'HTTP ' + res.status + (errText ? '：' + errText.substring(0, 120) : '') };
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'AI 返回内容为空' };
    return { ok: true, content: String(content).trim() };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 120) };
  }
}

// 小璐记账 · 语音记账模块
// 录音 → Whisper STT → AI 解析 → 结构化账目
// 使用 React Native 内置 API 录音，不依赖 expo-av
import { Platform } from 'react-native';
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';
import { parseTransactionFromText } from './aiParser';

// ─── 录音 ────────────────────────────────────────────

/**
 * 开始录音。返回录音实例。
 */
export async function startRecording() {
  // React Native 没有内置录音 API。
  // 在支持 expo-av 的构建中会转调原生模块。
  // 当前兜底：抛出明确的错误引导用户。
  throw new Error('语音录制功能需要原生模块支持，请更新到最新版本');
}

/**
 * 停止录音，返回音频文件 URI
 */
export async function stopRecording(recording) {
  return null;
}

// ─── Whisper 语音转文字 ───────────────────────────────

/**
 * 调用 OpenAI Whisper 兼容 API 将音频转为文字。
 */
async function transcribeWithWhisper(audioUri) {
  const config = await loadAiConfig();
  if (!config.apiKey) return { ok: false, error: '未配置 API Key' };
  if (!config.enabled) return { ok: false, error: 'AI 功能未启用' };

  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) return { ok: false, error: '接口地址未配置' };

  const fileName = audioUri.split('/').pop() || 'recording.m4a';
  const ext = fileName.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeMap = {
    m4a: 'audio/mp4', mp3: 'audio/mpeg', mp4: 'audio/mp4',
    wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg',
    oga: 'audio/ogg', flac: 'audio/flac',
  };
  const mimeType = mimeMap[ext] || 'audio/mp4';

  const formData = new FormData();
  const fileField = Platform.OS === 'web'
    ? await (async () => {
        try { const r = await fetch(audioUri); return await r.blob(); } catch { return new Blob([], { type: mimeType }); }
      })()
    : { uri: audioUri, type: mimeType, name: fileName };
  formData.append('file', fileField);
  formData.append('model', 'whisper-1');

  try {
    const res = await fetch(baseURL + '/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.apiKey },
      body: formData,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效（401）' };
      if (res.status === 404) return { ok: false, error: '当前服务商不支持语音转文字，请切换到 OpenAI' };
      if (res.status === 429) return { ok: false, error: '请求过快（429）' };
      return { ok: false, error: '语音识别失败（HTTP ' + res.status + '）' };
    }
    const json = await res.json();
    const text = json?.text;
    if (!text || !text.trim()) return { ok: false, error: '未识别到语音内容' };
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 120) };
  }
}

// ─── 完整流水线：语音 → 账目 ────────────────────────────

export async function voiceToTransaction(audioUri) {
  const sttResult = await transcribeWithWhisper(audioUri);
  if (!sttResult.ok) return { ok: false, error: sttResult.error, stage: 'stt' };

  const transcribedText = sttResult.text;
  const parseResult = await parseTransactionFromText(transcribedText);
  if (!parseResult.ok) {
    return { ok: false, error: parseResult.error || '解析失败', stage: 'parse', transcribedText };
  }

  const data = parseResult.multiple && Array.isArray(parseResult.data)
    ? parseResult.data[0]
    : parseResult.data;

  return { ok: true, data, transcribedText, multiple: !!parseResult.multiple };
}
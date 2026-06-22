// 小璐记账 · 语音记账模块
// 录音 → Whisper STT → AI 解析 → 结构化账目
// expo-av 使用动态 require 避免模块加载时闪退
import { Platform } from 'react-native';
import { loadAiConfig, AI_PROVIDERS } from './aiConfig';
import { parseTransactionFromText } from './aiParser';

// ─── expo-av lazy loader ──────────────────────────────
// 使用异步 import() 而非同步 require()，避免模块加载时的
// requireNativeModule('ExponentAV') 异常传播到主线程。
// 同步 require() 即使包 try-catch 也可能被 Metro 缓存机制放大。

let _audioPromise = null;

async function getAudioAsync() {
  if (_audioPromise) return _audioPromise;
  _audioPromise = (async () => {
    try {
      const AV = await import('expo-av');
      return AV.Audio;
    } catch {
      return null;
    }
  })();
  return _audioPromise;
}

// ─── 权限 ────────────────────────────────────────────

let _permissionGranted = null;

export async function ensureAudioPermission() {
  if (_permissionGranted) return true;
  const Audio = await getAudioAsync();
  if (!Audio) return false;
  try {
    const { status } = await Audio.requestPermissionsAsync();
    _permissionGranted = status === 'granted';
    return _permissionGranted;
  } catch {
    return false;
  }
}

// ─── 录音 ────────────────────────────────────────────

/**
 * 开始录音。返回 Audio.Recording 实例。
 * 调用方需要在组件卸载时停止录音。
 */
export async function startRecording() {
  const Audio = await getAudioAsync();
  if (!Audio) throw new Error('expo-av 模块未加载');

  const ok = await ensureAudioPermission();
  if (!ok) throw new Error('麦克风权限未授权');

  // 设置音频模式
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const recording = new Audio.Recording();

  // Android 使用 AAC（m4a），iOS 也用 m4a — Whisper 都支持
  await recording.prepareToRecordAsync(
    Platform.OS === 'ios'
      ? Audio.RecordingOptionsPresets.HIGH_QUALITY
      : {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          web: {},
        }
  );

  await recording.startAsync();
  return recording;
}

/**
 * 停止录音，返回音频文件 URI
 */
export async function stopRecording(recording) {
  try {
    await recording.stopAndUnloadAsync();
    return recording.getURI();
  } catch (e) {
    // 如果已经是停止状态（比如组件卸载时），忽略错误
    return null;
  }
}

// ─── Whisper 语音转文字 ───────────────────────────────

/**
 * 调用 OpenAI Whisper 兼容 API 将音频转为文字。
 *
 * POST {baseURL}/audio/transcriptions
 * Content-Type: multipart/form-data
 *
 * @param {string} audioUri - 音频文件路径
 * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string }>}
 */
async function transcribeWithWhisper(audioUri) {
  const config = await loadAiConfig();
  if (!config.apiKey) return { ok: false, error: '未配置 API Key' };
  if (!config.enabled) return { ok: false, error: 'AI 功能未启用' };

  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) return { ok: false, error: '接口地址未配置' };

  // 读取音频文件名和扩展名
  const fileName = audioUri.split('/').pop() || 'recording.m4a';
  const ext = fileName.split('.').pop()?.toLowerCase() || 'm4a';
  const mimeMap = {
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    flac: 'audio/flac',
  };
  const mimeType = mimeMap[ext] || 'audio/mp4';

  // 构建 multipart/form-data
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: mimeType,
    name: fileName,
  });
  formData.append('model', 'whisper-1');

  try {
    const res = await fetch(baseURL + '/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        // 不要手动设置 Content-Type，让 RN 自动生成带 boundary 的 multipart header
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) return { ok: false, error: 'API Key 无效（401）' };
      if (res.status === 404) return {
        ok: false,
        error: '当前服务商不支持语音转文字，请在设置 → AI 配置中切换到 OpenAI 或支持 Whisper 的服务商',
      };
      if (res.status === 429) return { ok: false, error: '请求过快，请稍后重试（429）' };
      return { ok: false, error: '语音识别失败（HTTP ' + res.status + '）' };
    }

    const json = await res.json();
    const text = json?.text;
    if (!text || !text.trim()) return { ok: false, error: '未识别到语音内容，请重试' };
    return { ok: true, text: text.trim() };
  } catch (e) {
    return { ok: false, error: '网络错误：' + (e?.message || String(e)).substring(0, 120) };
  }
}

// ─── 完整流水线：语音 → 账目 ────────────────────────────

/**
 * 语音 → AI 解析 → 结构化账目。
 * 一步完成：录音文件 → Whisper 转文字 → parseTransactionFromText 解析。
 *
 * @param {string} audioUri - 音频文件路径
 * @returns {Promise<{
 *   ok: true,
 *   data: { amount, type, category, date, note },
 *   transcribedText: string
 * } | {
 *   ok: false,
 *   error: string,
 *   stage: 'stt' | 'parse'
 * }>}
 */
export async function voiceToTransaction(audioUri) {
  // 第一步：语音转文字
  const sttResult = await transcribeWithWhisper(audioUri);
  if (!sttResult.ok) {
    return { ok: false, error: sttResult.error, stage: 'stt' };
  }

  const transcribedText = sttResult.text;

  // 第二步：AI 解析自然语言 → 结构化账目
  const parseResult = await parseTransactionFromText(transcribedText);
  if (!parseResult.ok) {
    return {
      ok: false,
      error: parseResult.error || '解析失败',
      stage: 'parse',
      transcribedText,
    };
  }

  // 处理多笔账目：只取第一笔（语音场景一般只说一笔）
  const data = parseResult.multiple && Array.isArray(parseResult.data)
    ? parseResult.data[0]
    : parseResult.data;

  return { ok: true, data, transcribedText, multiple: !!parseResult.multiple };
}

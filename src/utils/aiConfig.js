// 小璐记账 · AI 配置管理
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lulu_ai_config';

// 服务商预设
export const AI_PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    needsPath: false,
  },
  zhipu: {
    label: '智谱 GLM',
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    models: ['glm-5', 'glm-5-turbo', 'glm-4.7-flash'],
    needsPath: false,
  },
  qwen: {
    label: '通义千问',
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.5-flash', 'qwen3.5-plus', 'qwen3-max'],
    needsPath: false,
  },
  openai: {
    label: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    models: ['gpt-5.5-instant', 'gpt-5.4-thinking', 'gpt-5.3-codex'],
    needsPath: false,
  },
  custom: {
    label: '自定义',
    defaultBaseURL: '',
    models: [],
    needsPath: false,
  },
};

export const DEFAULT_CONFIG = {
  provider: 'deepseek',
  apiKey: '',
  baseURL: AI_PROVIDERS.deepseek.defaultBaseURL,
  model: 'deepseek-v4-flash',
  customModel: '',
  enabled: false,
};

export async function loadAiConfig() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveAiConfig(config) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearAiConfig() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// 测试连接：调 /models 列表（OpenAI 兼容协议）
// 返回 { ok, message, modelCount? }
export async function testAiConnection(config) {
  if (!config.apiKey) {
    return { ok: false, message: '请填写 API Key' };
  }
  const baseURL = (config.baseURL || AI_PROVIDERS[config.provider]?.defaultBaseURL || '').replace(/\/+$/, '');
  if (!baseURL) {
    return { ok: false, message: '请填写接口地址' };
  }
  const model = config.model === '__custom__' ? config.customModel : config.model;
  if (!model) {
    return { ok: false, message: '请填写模型名' };
  }
  try {
    const url = baseURL + '/models';
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      let modelCount = 0;
      try {
        const data = await res.json();
        modelCount = data?.data?.length || 0;
      } catch {}
      return { ok: true, message: '连接成功' + (modelCount > 0 ? '，可用模型 ' + modelCount + ' 个' : '') };
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      return { ok: false, message: 'API Key 无效（401）' };
    }
    if (res.status === 403) {
      return { ok: false, message: 'API Key 无权限（403）' };
    }
    if (res.status === 404) {
      return { ok: false, message: '接口地址不正确（404）' };
    }
    return { ok: false, message: 'HTTP ' + res.status + (text ? '：' + text.substring(0, 80) : '') };
  } catch (e) {
    return { ok: false, message: '网络错误：' + (e?.message || String(e)).substring(0, 100) };
  }
}
import { invoke } from '@tauri-apps/api/core';

export interface LlmSettingsView {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatResult {
  content: string;
  model?: string;
}

export interface LlmChatOptions {
  temperature?: number;
  jsonMode?: boolean;
}

/** 把 Rust 侧返回的错误统一转成 Error */
function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('LLM 请求失败');
}

/** 读取 LLM 设置（不含 API Key） */
export async function getLlmSettings(): Promise<LlmSettingsView> {
  try {
    return await invoke<LlmSettingsView>('get_llm_settings');
  } catch (error) {
    throw toError(error);
  }
}

/** 保存 LLM 设置；apiKey 留空表示保留原有 Key */
export async function setLlmSettings(input: {
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
}): Promise<void> {
  try {
    await invoke('set_llm_settings', {
      baseUrl: input.baseUrl,
      model: input.model,
      apiKey: input.apiKey,
      clearApiKey: input.clearApiKey ?? false,
    });
  } catch (error) {
    throw toError(error);
  }
}

/** 测试连接 */
export async function testLlmConnection(): Promise<LlmChatResult> {
  try {
    return await invoke<LlmChatResult>('test_llm_connection');
  } catch (error) {
    throw toError(error);
  }
}

/** 发送对话请求（API Key 由 Rust 侧注入） */
export async function llmChat(
  messages: LlmChatMessage[],
  options: LlmChatOptions = {}
): Promise<LlmChatResult> {
  try {
    return await invoke<LlmChatResult>('llm_chat', {
      messages,
      temperature: options.temperature ?? 0.7,
      jsonMode: options.jsonMode ?? false,
    });
  } catch (error) {
    throw toError(error);
  }
}

/**
 * 是否已配置可用（有 Key 且有模型名）
 * 任意异常都视为未配置，避免阻塞 UI
 */
export async function isLlmConfigured(): Promise<boolean> {
  try {
    const settings = await getLlmSettings();
    return settings.hasApiKey && settings.model.trim().length > 0;
  } catch {
    return false;
  }
}

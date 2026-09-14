//! LLM 接入：OpenAI 兼容 API 的 Rust 侧转发
//!
//! API Key 只保存在应用数据目录下的 `llm_settings.json`，永远不会返回给前端。
//! 前端只负责发送对话消息，Key 由 Rust 侧自行读取并注入请求头。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;

const SETTINGS_FILE: &str = "llm_settings.json";
const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "";
const REQUEST_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LlmSettingsFile {
    #[serde(default)]
    base_url: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    api_key: String,
}

/// 返回给前端的设置视图（不含 apiKey）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSettingsView {
    pub base_url: String,
    pub model: String,
    pub has_api_key: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmChatResult {
    pub content: String,
    pub model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorEnvelope {
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    message: Option<String>,
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录：{e}"))?;
    Ok(dir.join(SETTINGS_FILE))
}

fn load_settings(app: &tauri::AppHandle) -> Result<LlmSettingsFile, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(LlmSettingsFile {
            base_url: DEFAULT_BASE_URL.to_string(),
            model: DEFAULT_MODEL.to_string(),
            api_key: String::new(),
        });
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("读取 LLM 配置失败：{e}"))?;
    if content.trim().is_empty() {
        return Ok(LlmSettingsFile::default());
    }
    serde_json::from_str(&content).map_err(|e| format!("解析 LLM 配置失败：{e}"))
}

fn save_settings(app: &tauri::AppHandle, settings: &LlmSettingsFile) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败：{e}"))?;
    }
    let content =
        serde_json::to_string_pretty(settings).map_err(|e| format!("序列化配置失败：{e}"))?;
    fs::write(&path, content).map_err(|e| format!("写入 LLM 配置失败：{e}"))?;
    Ok(())
}

/// 把用户填写的 Base URL 归一化为 chat/completions 端点
pub fn normalize_chat_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return format!("{DEFAULT_BASE_URL}/chat/completions");
    }
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/chat/completions")
    }
}

fn extract_api_error_message(body: &str) -> Option<String> {
    let envelope: ApiErrorEnvelope = serde_json::from_str(body).ok()?;
    envelope.error?.message
}

fn map_http_error(status: u16, body: &str) -> String {
    let detail = extract_api_error_message(body).unwrap_or_else(|| body.trim().to_string());
    let detail = if detail.is_empty() {
        String::new()
    } else {
        format!("：{detail}")
    };
    match status {
        401 => format!("API Key 无效或已过期{detail}"),
        403 => format!("无权限访问该模型{detail}"),
        404 => format!("Base URL 或模型名不存在{detail}"),
        429 => format!("请求过于频繁或额度不足{detail}"),
        500..=599 => format!("模型服务端错误（{status}）{detail}"),
        _ => format!("请求失败（{status}）{detail}"),
    }
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{e}"))
}

async fn request_chat(
    app: &tauri::AppHandle,
    messages: Vec<ChatMessage>,
    temperature: f32,
    json_mode: bool,
) -> Result<LlmChatResult, String> {
    let settings = load_settings(app)?;

    if settings.api_key.trim().is_empty() {
        return Err("尚未配置 API Key".to_string());
    }
    if settings.model.trim().is_empty() {
        return Err("尚未配置模型名称".to_string());
    }

    let url = normalize_chat_url(&settings.base_url);

    let mut payload = serde_json::json!({
        "model": settings.model,
        "messages": messages,
        "temperature": temperature,
    });
    if json_mode {
        payload["response_format"] = serde_json::json!({ "type": "json_object" });
    }

    let client = build_client()?;
    let response = client
        .post(&url)
        .bearer_auth(settings.api_key.trim())
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "请求超时".to_string()
            } else if e.is_connect() {
                "无法连接到 API 服务，请检查 Base URL 与网络".to_string()
            } else {
                format!("请求失败：{e}")
            }
        })?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败：{e}"))?;

    if !status.is_success() {
        return Err(map_http_error(status.as_u16(), &body));
    }

    let parsed: ChatCompletionResponse =
        serde_json::from_str(&body).map_err(|e| format!("解析模型响应失败：{e}"))?;

    let content = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|choice| choice.message.content)
        .unwrap_or_default();

    if content.trim().is_empty() {
        return Err("模型返回了空内容".to_string());
    }

    Ok(LlmChatResult {
        content,
        model: parsed.model,
    })
}

/// 读取 LLM 设置（不含 API Key）
#[tauri::command]
pub fn get_llm_settings(app: tauri::AppHandle) -> Result<LlmSettingsView, String> {
    let settings = load_settings(&app)?;
    let base_url = if settings.base_url.trim().is_empty() {
        DEFAULT_BASE_URL.to_string()
    } else {
        settings.base_url
    };
    Ok(LlmSettingsView {
        base_url,
        model: settings.model,
        has_api_key: !settings.api_key.trim().is_empty(),
    })
}

/// 保存 LLM 设置；api_key 为空时保留原有 Key
#[tauri::command]
pub fn set_llm_settings(
    app: tauri::AppHandle,
    base_url: String,
    model: String,
    api_key: Option<String>,
    clear_api_key: Option<bool>,
) -> Result<(), String> {
    let mut settings = load_settings(&app)?;

    let trimmed_base = base_url.trim().to_string();
    settings.base_url = if trimmed_base.is_empty() {
        DEFAULT_BASE_URL.to_string()
    } else {
        trimmed_base
    };
    settings.model = model.trim().to_string();

    if clear_api_key.unwrap_or(false) {
        settings.api_key = String::new();
    } else if let Some(key) = api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            settings.api_key = trimmed.to_string();
        }
    }

    save_settings(&app, &settings)
}

/// 测试连接：发送一条最小请求
#[tauri::command]
pub async fn test_llm_connection(app: tauri::AppHandle) -> Result<LlmChatResult, String> {
    request_chat(
        &app,
        vec![ChatMessage {
            role: "user".to_string(),
            content: "ping".to_string(),
        }],
        0.0,
        false,
    )
    .await
}

/// 发送对话请求（API Key 由 Rust 侧从磁盘读取）
#[tauri::command]
pub async fn llm_chat(
    app: tauri::AppHandle,
    messages: Vec<ChatMessage>,
    temperature: Option<f32>,
    json_mode: Option<bool>,
) -> Result<LlmChatResult, String> {
    request_chat(
        &app,
        messages,
        temperature.unwrap_or(0.7),
        json_mode.unwrap_or(false),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::normalize_chat_url;

    #[test]
    fn normalizes_base_url() {
        assert_eq!(
            normalize_chat_url("https://api.openai.com/v1"),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_url("https://api.openai.com/v1/"),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_url("https://api.deepseek.com/v1/chat/completions"),
            "https://api.deepseek.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_url("  https://localhost:11434/v1  "),
            "https://localhost:11434/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_url(""),
            "https://api.openai.com/v1/chat/completions"
        );
    }
}

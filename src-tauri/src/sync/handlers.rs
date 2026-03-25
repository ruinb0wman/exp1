//! API 处理器（简化版）
//!
//! 处理同步相关的 HTTP 请求

use axum::{
    extract::State,
    response::Json,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use tauri::Emitter;

use crate::sync::{
    types::*,
    server::get_app_handle,
};

/// 应用状态（简化版）
pub struct AppState {
    /// 存储手机上传的数据
    pub mobile_data: RwLock<std::collections::HashMap<String, SyncData>>,
    /// 存储 PC 前端提供的数据（通过 IPC）- 原始压缩数据
    pub pc_data_raw: RwLock<std::collections::HashMap<String, Vec<u8>>>,
    /// 存储合并后的数据（由手机端合并后上传）
    pub merged_data: RwLock<std::collections::HashMap<String, SyncData>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            mobile_data: RwLock::new(std::collections::HashMap::new()),
            pc_data_raw: RwLock::new(std::collections::HashMap::new()),
            merged_data: RwLock::new(std::collections::HashMap::new()),
        }
    }
}

/// 处理初始化请求
pub async fn handle_init(
    _state: State<Arc<AppState>>,
    Json(req): Json<InitRequest>,
) -> Json<InitResponse> {
    let session_id = Uuid::new_v4().to_string();
    log::info!("[Sync] handle_init: Creating new session {}", session_id);

    // TODO: 获取上次同步时间
    let last_sync_at: Option<chrono::DateTime<chrono::Utc>> = None;

    log::info!("[Sync] handle_init: Session {} initialized successfully", session_id);

    Json(InitResponse {
        server_time: chrono::Utc::now(),
        last_sync_at,
        session_id,
        tables: vec![
            SyncTable::TaskTemplates,
            SyncTable::TaskInstances,
            SyncTable::RewardTemplates,
            SyncTable::RewardInstances,
            SyncTable::Users,
            SyncTable::PointsHistory,
        ],
    })
}

/// 处理上传数据请求（手机端上传自己的数据）
pub async fn handle_upload(
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> Json<UploadResponse> {
    log::info!("[Sync] handle_upload: Received upload request, body size: {} bytes", body.len());

    // 解压 gzip 数据
    let decompressed = match decompress_gzip(&body) {
        Ok(data) => {
            log::info!("[Sync] handle_upload: Decompressed {} bytes", data.len());
            data
        }
        Err(e) => {
            log::error!("[Sync] handle_upload: Failed to decompress: {}", e);
            return Json(UploadResponse {
                session_id: String::new(),
                status: UploadStatus::Error,
                message: Some(format!("Failed to decompress: {}", e)),
            });
        }
    };

    // 解析 JSON
    let mobile_data: SyncData = match serde_json::from_slice::<SyncData>(&decompressed) {
        Ok(data) => {
            log::info!("[Sync] handle_upload: Parsed JSON, session_id: {}, device: {:?}, tables: {:?}",
                data.session_id, data.device_id, data.tables.keys().collect::<Vec<_>>());
            data
        }
        Err(e) => {
            log::error!("[Sync] handle_upload: Failed to parse JSON: {}", e);
            return Json(UploadResponse {
                session_id: String::new(),
                status: UploadStatus::Error,
                message: Some(format!("Failed to parse JSON: {}", e)),
            });
        }
    };

    let session_id = mobile_data.session_id.clone();
    log::info!("[Sync] handle_upload: Processing session {}", session_id);

    // 存储手机数据
    {
        let mut mobile = state.mobile_data.write().await;
        mobile.insert(session_id.clone(), mobile_data);
        log::info!("[Sync] handle_upload: Stored mobile data for session {}, total mobile_data entries: {}",
            session_id, mobile.len());
    }

    // 发送 IPC 事件通知 PC 前端提供数据
    log::info!("[Sync] handle_upload: Emitting sync:request-pc-data event for session {}", session_id);
    if let Some(app_handle) = get_app_handle().await {
        match app_handle.emit("sync:request-pc-data", serde_json::json!({
            "sessionId": session_id
        })) {
            Ok(_) => log::info!("[Sync] handle_upload: Successfully emitted sync:request-pc-data event"),
            Err(e) => log::error!("[Sync] handle_upload: Failed to emit event: {}", e),
        }
    } else {
        log::error!("[Sync] handle_upload: AppHandle not available, cannot emit event");
    }

    log::info!("[Sync] handle_upload: Upload processed successfully for session {}", session_id);

    // 返回成功，等待后续操作
    Json(UploadResponse {
        session_id: session_id.clone(),
        status: UploadStatus::Success,
        message: Some("Mobile data received".to_string()),
    })
}

/// 处理下载请求（手机端下载 PC 的数据）
pub async fn handle_download(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DownloadRequest>,
) -> axum::response::Response {
    let session_id = req.session_id.clone();
    log::info!("[Sync] handle_download: Download request for session {}", session_id);

    // 获取 PC 原始压缩数据
    let compressed_data = {
        let pc_data_map = state.pc_data_raw.read().await;
        log::info!("[Sync] handle_download: PC raw data map has {} entries", pc_data_map.len());
        match pc_data_map.get(&session_id) {
            Some(data) => {
                log::info!("[Sync] handle_download: Found PC raw data for session {}, size: {} bytes",
                    session_id, data.len());
                data.clone()
            }
            None => {
                log::error!("[Sync] handle_download: PC data not found for session {}", session_id);
                return axum::response::Response::builder()
                    .status(404)
                    .body("PC data not found".into())
                    .unwrap();
            }
        }
    };

    log::info!("[Sync] handle_download: Sending PC raw data for session {}, size: {} bytes", 
        session_id, compressed_data.len());

    axum::response::Response::builder()
        .header("Content-Type", "application/octet-stream")
        // 注意：不要设置 Content-Encoding: gzip，否则浏览器会自动解压
        // 前端需要手动解压数据
        .body(compressed_data.into())
        .unwrap()
}

/// 处理应用数据请求（手机端上传合并后的数据，PC 端应用）
pub async fn handle_apply(
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> Json<UploadResponse> {
    log::info!("[Sync] handle_apply: Received apply request, body size: {} bytes", body.len());

    // 解压 gzip 数据
    let decompressed = match decompress_gzip(&body) {
        Ok(data) => {
            log::info!("[Sync] handle_apply: Decompressed {} bytes", data.len());
            data
        }
        Err(e) => {
            log::error!("[Sync] handle_apply: Failed to decompress: {}", e);
            return Json(UploadResponse {
                session_id: String::new(),
                status: UploadStatus::Error,
                message: Some(format!("Failed to decompress: {}", e)),
            });
        }
    };

    // 解析 JSON
    let merged_data: SyncData = match serde_json::from_slice::<SyncData>(&decompressed) {
        Ok(data) => {
            log::info!("[Sync] handle_apply: Parsed JSON, session_id: {}, tables: {:?}",
                data.session_id, data.tables.keys().collect::<Vec<_>>());
            data
        }
        Err(e) => {
            log::error!("[Sync] handle_apply: Failed to parse JSON: {}", e);
            return Json(UploadResponse {
                session_id: String::new(),
                status: UploadStatus::Error,
                message: Some(format!("Failed to parse JSON: {}", e)),
            });
        }
    };

    let session_id = merged_data.session_id.clone();
    log::info!("[Sync] handle_apply: Processing merged data for session {}", session_id);

    // 存储合并后的数据
    {
        let mut merged = state.merged_data.write().await;
        merged.insert(session_id.clone(), merged_data);
        log::info!("[Sync] handle_apply: Stored merged data for session {}, total merged_data entries: {}",
            session_id, merged.len());
    }

    // 发送 IPC 事件通知 PC 前端应用数据
    log::info!("[Sync] handle_apply: Emitting sync:apply-merged-data event for session {}", session_id);
    if let Some(app_handle) = get_app_handle().await {
        match app_handle.emit("sync:apply-merged-data", serde_json::json!({
            "sessionId": session_id
        })) {
            Ok(_) => log::info!("[Sync] handle_apply: Successfully emitted sync:apply-merged-data event"),
            Err(e) => log::error!("[Sync] handle_apply: Failed to emit event: {}", e),
        }
    } else {
        log::error!("[Sync] handle_apply: AppHandle not available, cannot emit event");
    }

    log::info!("[Sync] handle_apply: Apply request processed for session {}", session_id);

    // 返回成功，等待 PC 前端通过 IPC 应用数据
    Json(UploadResponse {
        session_id: session_id.clone(),
        status: UploadStatus::Success,
        message: Some("Merged data received, waiting for PC to apply".to_string()),
    })
}

/// 处理完成请求
pub async fn handle_complete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CompleteRequest>,
) -> Json<CompleteResponse> {
    let session_id = req.session_id.clone();
    log::info!("[Sync] handle_complete: Complete request for session {}", session_id);

    // 清理数据缓存
    {
        let mut mobile = state.mobile_data.write().await;
        mobile.remove(&session_id);
        log::info!("[Sync] handle_complete: Removed mobile data, remaining: {}", mobile.len());
    }
    {
        let mut pc = state.pc_data_raw.write().await;
        pc.remove(&session_id);
        log::info!("[Sync] handle_complete: Removed pc raw data, remaining: {}", pc.len());
    }
    {
        let mut merged = state.merged_data.write().await;
        merged.remove(&session_id);
        log::info!("[Sync] handle_complete: Removed merged data, remaining: {}", merged.len());
    }

    // 发送 IPC 事件通知同步完成
    log::info!("[Sync] handle_complete: Emitting sync:completed event for session {}", session_id);
    if let Some(app_handle) = get_app_handle().await {
        match app_handle.emit("sync:completed", serde_json::json!({
            "sessionId": session_id,
            "success": true
        })) {
            Ok(_) => log::info!("[Sync] handle_complete: Successfully emitted sync:completed event"),
            Err(e) => log::error!("[Sync] handle_complete: Failed to emit event: {}", e),
        }
    } else {
        log::warn!("[Sync] handle_complete: AppHandle not available, cannot emit event");
    }

    log::info!("[Sync] handle_complete: Session {} completed successfully", session_id);

    Json(CompleteResponse {
        session_id: session_id.clone(),
        success: true,
        message: Some("Sync completed successfully".to_string()),
    })
}

/// 解压 gzip 数据
fn decompress_gzip(data: &[u8]) -> Result<Vec<u8>, String> {
    use flate2::read::GzDecoder;
    use std::io::Read;

    let mut decoder = GzDecoder::new(data);
    let mut result = Vec::new();
    decoder
        .read_to_end(&mut result)
        .map_err(|e| format!("Decompression failed: {}", e))?;
    Ok(result)
}

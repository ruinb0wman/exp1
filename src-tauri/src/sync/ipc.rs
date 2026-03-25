//! IPC 命令和事件处理
//!
//! 提供 PC 前端与 Rust 后端通信的接口

use crate::sync::{
    server::{get_app_state, get_app_handle},
};

/// 存储 PC 数据到服务器状态（接收压缩后的原始数据）
#[tauri::command]
pub async fn set_pc_sync_data(
    session_id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    log::info!("[Sync IPC] set_pc_sync_data called for session {}", session_id);

    // 获取应用状态
    let app_state = get_app_state().await
        .ok_or_else(|| {
            log::error!("[Sync IPC] set_pc_sync_data: Sync server not running");
            "Sync server not running".to_string()
        })?;

    // 将 JSON 数据序列化为字节
    log::info!("[Sync IPC] set_pc_sync_data: Serializing data...");
    let json_bytes = serde_json::to_vec(&data)
        .map_err(|e| {
            log::error!("[Sync IPC] set_pc_sync_data: Failed to serialize data: {}", e);
            format!("Failed to serialize data: {}", e)
        })?;

    log::info!("[Sync IPC] set_pc_sync_data: Serialized {} bytes, compressing...", json_bytes.len());

    // 压缩数据
    let compressed = compress_gzip_bytes(&json_bytes)
        .map_err(|e| {
            log::error!("[Sync IPC] set_pc_sync_data: Failed to compress: {}", e);
            format!("Failed to compress: {}", e)
        })?;

    log::info!("[Sync IPC] set_pc_sync_data: Compressed to {} bytes", compressed.len());

    // 存储压缩后的原始数据
    {
        let mut pc_data_raw = app_state.pc_data_raw.write().await;
        pc_data_raw.insert(session_id.clone(), compressed);
        log::info!("[Sync IPC] set_pc_sync_data: Stored PC raw data, total entries: {}", pc_data_raw.len());
    }

    // 发送事件通知前端数据已设置
    if let Some(app_handle) = get_app_handle().await {
        match app_handle.emit("sync:pc-data-received", serde_json::json!({
            "sessionId": session_id
        })) {
            Ok(_) => log::info!("[Sync IPC] set_pc_sync_data: Emitted sync:pc-data-received event"),
            Err(e) => log::error!("[Sync IPC] set_pc_sync_data: Failed to emit event: {}", e),
        }
    } else {
        log::warn!("[Sync IPC] set_pc_sync_data: AppHandle not available");
    }

    log::info!("[Sync IPC] set_pc_sync_data completed for session {}", session_id);
    Ok(())
}

/// 获取合并后的数据（供 PC 前端应用）
#[tauri::command]
pub async fn get_merged_sync_data(
    session_id: String,
) -> Result<serde_json::Value, String> {
    log::info!("[Sync IPC] get_merged_sync_data called for session {}", session_id);

    // 获取应用状态
    let app_state = get_app_state().await
        .ok_or_else(|| {
            log::error!("[Sync IPC] get_merged_sync_data: Sync server not running");
            "Sync server not running".to_string()
        })?;

    // 获取合并后的数据
    let merged_data = {
        let merged = app_state.merged_data.read().await;
        log::info!("[Sync IPC] get_merged_sync_data: merged_data has {} entries", merged.len());
        merged.get(&session_id).cloned()
    };

    match merged_data {
        Some(data) => {
            log::info!("[Sync IPC] get_merged_sync_data: Found merged data for session {}, tables: {:?}",
                session_id, data.tables.keys().collect::<Vec<_>>());

            // 发送事件通知前端可以获取数据
            if let Some(app_handle) = get_app_handle().await {
                match app_handle.emit("sync:merged-data-ready", serde_json::json!({
                    "sessionId": session_id
                })) {
                    Ok(_) => log::info!("[Sync IPC] get_merged_sync_data: Emitted sync:merged-data-ready event"),
                    Err(e) => log::error!("[Sync IPC] get_merged_sync_data: Failed to emit event: {}", e),
                }
            }

            // 返回数据
            serde_json::to_value(data)
                .map_err(|e| {
                    log::error!("[Sync IPC] get_merged_sync_data: Failed to serialize data: {}", e);
                    format!("Failed to serialize data: {}", e)
                })
        }
        None => {
            log::error!("[Sync IPC] get_merged_sync_data: Merged data not found for session {}", session_id);
            Err("Merged data not found".to_string())
        }
    }
}

/// 清理同步会话
#[tauri::command]
pub async fn clear_sync_session(
    session_id: String,
) -> Result<(), String> {
    log::info!("[Sync IPC] clear_sync_session called for session {}", session_id);

    // 获取应用状态
    let app_state = get_app_state().await
        .ok_or_else(|| {
            log::error!("[Sync IPC] clear_sync_session: Sync server not running");
            "Sync server not running".to_string()
        })?;

    // 清理数据
    {
        let mut mobile = app_state.mobile_data.write().await;
        let removed = mobile.remove(&session_id);
        log::info!("[Sync IPC] clear_sync_session: Removed mobile data: {}", removed.is_some());
    }
    {
        let mut pc = app_state.pc_data_raw.write().await;
        let removed = pc.remove(&session_id);
        log::info!("[Sync IPC] clear_sync_session: Removed pc raw data: {}", removed.is_some());
    }
    {
        let mut merged = app_state.merged_data.write().await;
        let removed = merged.remove(&session_id);
        log::info!("[Sync IPC] clear_sync_session: Removed merged data: {}", removed.is_some());
    }


    // 发送事件通知前端清理完成
    if let Some(app_handle) = get_app_handle().await {
        match app_handle.emit("sync:session-cleared", serde_json::json!({
            "sessionId": session_id
        })) {
            Ok(_) => log::info!("[Sync IPC] clear_sync_session: Emitted sync:session-cleared event"),
            Err(e) => log::error!("[Sync IPC] clear_sync_session: Failed to emit event: {}", e),
        }
    }

    log::info!("[Sync IPC] clear_sync_session completed for session {}", session_id);
    Ok(())
}

/// 压缩字节数据
fn compress_gzip_bytes(data: &[u8]) -> Result<Vec<u8>, String> {
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(data)
        .map_err(|e| format!("Compression failed: {}", e))?;

    encoder
        .finish()
        .map_err(|e| format!("Compression finish failed: {}", e))
}

// 导入 Emitter trait
use tauri::Emitter;

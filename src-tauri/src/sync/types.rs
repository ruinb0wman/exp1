//! 同步系统数据类型（简化版）
//!
//! 移除影子表，直接使用业务表的 updatedAt 字段

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 设备标识
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceId {
    Pc,
    Mobile,
}

impl std::fmt::Display for DeviceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DeviceId::Pc => write!(f, "pc"),
            DeviceId::Mobile => write!(f, "mobile"),
        }
    }
}

/// 同步表名
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncTable {
    TaskTemplates,
    TaskInstances,
    RewardTemplates,
    RewardInstances,
    Users,
    PointsHistory,
}

impl std::fmt::Display for SyncTable {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncTable::TaskTemplates => write!(f, "taskTemplates"),
            SyncTable::TaskInstances => write!(f, "taskInstances"),
            SyncTable::RewardTemplates => write!(f, "rewardTemplates"),
            SyncTable::RewardInstances => write!(f, "rewardInstances"),
            SyncTable::Users => write!(f, "users"),
            SyncTable::PointsHistory => write!(f, "pointsHistory"),
        }
    }
}

/// 同步数据包（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncData {
    pub device_id: DeviceId,
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub tables: HashMap<SyncTable, Vec<serde_json::Value>>,
}

/// 初始化同步请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitRequest {
    pub device_id: DeviceId,
    pub timestamp: DateTime<Utc>,
}

/// 初始化同步响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResponse {
    pub server_time: DateTime<Utc>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub session_id: String,
    pub tables: Vec<SyncTable>,
}

/// 上传数据响应（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResponse {
    pub session_id: String,
    pub status: UploadStatus,
    pub message: Option<String>,
}

/// 上传状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UploadStatus {
    Success,
    Error,
}

/// 下载数据请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub session_id: String,
}

/// 服务器状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub ip: Option<String>,
    pub qr_code: Option<String>,
}

/// 完成同步请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteRequest {
    pub session_id: String,
}

/// 完成同步响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteResponse {
    pub session_id: String,
    pub success: bool,
    pub message: Option<String>,
}

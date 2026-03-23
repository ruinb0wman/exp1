//! 同步系统数据类型

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

/// 同步元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMetadata {
    pub id: Option<i64>,
    pub table: SyncTable,
    pub local_id: i64,
    pub sync_id: String,
    pub version: i32,
    pub modified_at: DateTime<Utc>,
    pub modified_by: DeviceId,
    pub checksum: String,
    pub is_deleted: bool,
}

/// 同步会话
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSession {
    pub id: Option<i64>,
    pub session_id: String,
    pub device: DeviceId,
    pub direction: SyncDirection,
    pub status: SyncStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub stats: Option<SyncStats>,
}

/// 同步方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncDirection {
    Upload,
    Download,
    Bidirectional,
}

/// 同步状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Pending,
    Success,
    Failed,
    Conflict,
    Cancelled,
}

/// 同步统计
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStats {
    pub records_uploaded: i32,
    pub records_downloaded: i32,
    pub conflicts_resolved: i32,
    pub duration_ms: i64,
}

/// 同步数据包
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncData {
    pub device_id: DeviceId,
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub tables: HashMap<SyncTable, TableSyncData>,
}

/// 单个表的同步数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSyncData {
    pub metadata: Vec<SyncMetadata>,
    pub records: Vec<serde_json::Value>,
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

/// 上传数据响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResponse {
    pub session_id: String,
    pub status: UploadStatus,
    pub conflicts: Option<Vec<FieldConflict>>,
    pub message: Option<String>,
}

/// 上传状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UploadStatus {
    Success,
    Conflict,
    Error,
}

/// 字段冲突
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldConflict {
    pub table: SyncTable,
    pub sync_id: String,
    pub field: String,
    pub base_value: Option<serde_json::Value>,
    pub local_value: Option<serde_json::Value>,
    pub remote_value: Option<serde_json::Value>,
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

//! HTTP 服务器实现

use axum::{
    routing::post,
    Router,
};
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use once_cell::sync::Lazy;
use tauri::Emitter;

use crate::sync::{
    handlers::{self, AppState},
    network::{find_available_port, get_local_ip, generate_qr_data},
    qr_code::generate_qr_code,
    types::ServerStatus,
};

/// 默认起始端口
const DEFAULT_START_PORT: u16 = 8765;
/// 最大端口尝试次数
const MAX_PORT_ATTEMPTS: u16 = 100;
/// QR 码大小（像素）
const QR_CODE_SIZE: u32 = 256;
/// 服务器启动超时（秒）
const SERVER_START_TIMEOUT: u64 = 5;

/// 全局服务器状态
static SERVER_STATE: Lazy<Arc<RwLock<ServerState>>> = 
    Lazy::new(|| Arc::new(RwLock::new(ServerState::default())));

/// 全局应用状态（用于 IPC 访问）
static APP_STATE: Lazy<Arc<RwLock<Option<Arc<AppState>>>>> = 
    Lazy::new(|| Arc::new(RwLock::new(None)));

/// 全局 AppHandle（用于 IPC 事件）
static APP_HANDLE: Lazy<Arc<RwLock<Option<tauri::AppHandle>>>> = 
    Lazy::new(|| Arc::new(RwLock::new(None)));

/// 服务器状态
#[derive(Default)]
struct ServerState {
    running: bool,
    port: Option<u16>,
    ip: Option<String>,
    qr_code: Option<String>,
    shutdown_tx: Option<tokio::sync::mpsc::Sender<()>>,
}

/// 获取应用状态
pub async fn get_app_state() -> Option<Arc<AppState>> {
    let state = APP_STATE.read().await;
    state.clone()
}

/// 获取 AppHandle
pub async fn get_app_handle() -> Option<tauri::AppHandle> {
    let handle = APP_HANDLE.read().await;
    handle.clone()
}

/// 服务器启动结果
#[derive(serde::Serialize)]
pub struct ServerStartResult {
    pub ip: String,
    pub port: u16,
    pub qr_code: String,
}

/// 启动同步服务器
/// 
/// 1. 获取局域网 IP
/// 2. 查找可用端口
/// 3. 生成 QR 码
/// 4. 启动 HTTP 服务器
/// 5. 等待服务器确认启动
/// 6. 发送事件到前端
#[tauri::command]
pub async fn start_sync_server(app_handle: tauri::AppHandle) -> Result<ServerStartResult, String> {
    log::info!("Starting sync server...");
    
    let mut state = SERVER_STATE.write().await;
    
    // 检查是否已在运行
    if state.running {
        log::warn!("Sync server is already running");
        return Err("Sync server is already running".to_string());
    }
    
    // 1. 获取局域网 IP
    let ip = get_local_ip()?;
    log::info!("Using local IP: {}", ip);
    
    // 2. 查找可用端口
    let port = find_available_port(DEFAULT_START_PORT, MAX_PORT_ATTEMPTS)?;
    log::info!("Using port: {}", port);
    
    // 3. 生成 QR 码
    let qr_code_data = generate_qr_data(&ip, port)?;
    let qr_code = generate_qr_code(&qr_code_data, QR_CODE_SIZE)?;
    log::info!("QR code generated successfully");
    
    // 4. 创建关闭通道
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::mpsc::channel::<()>(1);
    
    // 5. 创建启动确认通道
    let (started_tx, started_rx) = tokio::sync::oneshot::channel();
    
    // 6. 构建路由
    let app_state = Arc::new(AppState::new());
    
    // 存储应用状态供 IPC 访问
    {
        let mut global_state = APP_STATE.write().await;
        *global_state = Some(app_state.clone());
    }
    
    let app = Router::new()
        .route("/api/sync/init", post(handlers::handle_init))
        .route("/api/sync/upload", post(handlers::handle_upload))
        .route("/api/sync/download", post(handlers::handle_download))
        .route("/api/sync/apply", post(handlers::handle_apply))
        .route("/api/sync/complete", post(handlers::handle_complete))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .with_state(app_state);
    
    // 7. 绑定端口
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    log::info!("Binding to address: {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| {
            log::error!("Failed to bind to {}: {}", addr, e);
            format!("Failed to bind to {}: {}", addr, e)
        })?;
    
    log::info!("Successfully bound to {}", addr);
    
    // 8. 在后台运行服务器
    let server_handle = tokio::spawn(async move {
        let server = axum::serve(listener, app);
        let shutdown_future = async move {
            let _ = shutdown_rx.recv().await;
            log::info!("Shutdown signal received, stopping server...");
        };
        
        // 通知主线程服务器即将开始运行
        let _ = started_tx.send(());
        log::info!("Server starting...");
        
        match server.with_graceful_shutdown(shutdown_future).await {
            Ok(_) => {
                log::info!("Server shutdown gracefully");
            }
            Err(e) => {
                log::error!("Server error: {}", e);
            }
        }
    });
    
    // 9. 等待服务器确认启动（带超时）
    log::info!("Waiting for server to start...");
    match tokio::time::timeout(
        Duration::from_secs(SERVER_START_TIMEOUT),
        started_rx
    ).await {
        Ok(Ok(())) => {
            log::info!("Server confirmed started");
        }
        Ok(Err(_)) => {
            log::error!("Server start confirmation channel closed unexpectedly");
            return Err("Server failed to start: confirmation channel closed".to_string());
        }
        Err(_) => {
            log::error!("Server start timeout after {} seconds", SERVER_START_TIMEOUT);
            // 尝试中止服务器任务
            server_handle.abort();
            return Err(format!("Server failed to start within {} seconds", SERVER_START_TIMEOUT));
        }
    }
    
    // 10. 验证服务器确实在监听
    log::info!("Verifying server is listening on port {}...", port);
    if !verify_server_listening(port).await {
        log::error!("Server verification failed: port {} is not listening", port);
        server_handle.abort();
        return Err("Server verification failed: port not listening".to_string());
    }
    log::info!("Server verification successful");
    
    // 11. 更新状态
    state.running = true;
    state.port = Some(port);
    state.ip = Some(ip.clone());
    state.qr_code = Some(qr_code.clone());
    state.shutdown_tx = Some(shutdown_tx);
    
    // 存储 app_handle 供后续使用
    {
        let mut global_app_handle = APP_HANDLE.write().await;
        *global_app_handle = Some(app_handle.clone());
    }
    
    // 12. 发送事件到前端
    let _ = app_handle.emit("sync:server-started", serde_json::json!({
        "ip": ip,
        "port": port,
        "qrCode": qr_code
    }));
    
    log::info!("Sync server successfully started on {}:{}", ip, port);
    Ok(ServerStartResult {
        ip: ip.clone(),
        port,
        qr_code: qr_code.clone(),
    })
}

/// 验证服务器是否在指定端口监听
async fn verify_server_listening(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    match tokio::net::TcpStream::connect(addr).await {
        Ok(_) => {
            log::info!("Successfully connected to server on port {}", port);
            true
        }
        Err(e) => {
            log::warn!("Failed to connect to server on port {}: {}", port, e);
            false
        }
    }
}

/// 停止同步服务器
#[tauri::command]
pub async fn stop_sync_server(app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut state = SERVER_STATE.write().await;
    
    if !state.running {
        return Err("Sync server is not running".to_string());
    }
    
    // 发送关闭信号
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(()).await;
    }

    // 更新状态
    state.running = false;
    state.port = None;
    state.ip = None;
    state.qr_code = None;

    // 清理全局状态
    {
        let mut global_state = APP_STATE.write().await;
        *global_state = None;
    }
    {
        let mut global_handle = APP_HANDLE.write().await;
        *global_handle = None;
    }

    // 发送事件到前端
    let _ = app_handle.emit("sync:server-stopped", ());
    
    log::info!("Sync server stopped");
    Ok(())
}

/// 获取服务器状态
#[tauri::command]
pub async fn get_server_status() -> ServerStatus {
    let state = SERVER_STATE.read().await;
    
    ServerStatus {
        running: state.running,
        port: state.port,
        ip: state.ip.clone(),
        qr_code: state.qr_code.clone(),
    }
}

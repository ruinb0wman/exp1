//! 同步系统模块
//!
//! 提供局域网同步功能，包括 HTTP 服务器、QR 码生成、数据合并等

pub mod handlers;
pub mod merge;
pub mod network;
pub mod qr_code;
pub mod server;
pub mod types;
pub mod ipc;

pub use server::{start_sync_server, stop_sync_server, get_server_status, ServerStartResult, get_app_state, get_app_handle};
pub use ipc::{set_pc_sync_data, get_merged_sync_data, clear_sync_session};

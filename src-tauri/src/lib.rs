use tauri::Manager;
use std::sync::Arc;

mod pomo_timer;
use pomo_timer::{PomoTimerManager, PomoMode, PomoTimerData};

mod pomo_native;

mod llm;

#[cfg(target_os = "android")]
mod pomo_background;
#[cfg(target_os = "android")]
use pomo_background::PomoBackgroundService;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 启动番茄钟计时器
#[tauri::command]
async fn start_pomo_timer(
    app: tauri::AppHandle,
    mode: String,
    duration: i64,
    session_id: Option<i64>,
    task_id: Option<String>,
) -> Result<(), String> {
    let mode = match mode.as_str() {
        "focus" => PomoMode::Focus,
        "shortBreak" => PomoMode::ShortBreak,
        "longBreak" => PomoMode::LongBreak,
        _ => return Err("Invalid mode".to_string()),
    };
    let manager = pomo_timer::get_timer_manager(&app);
    manager
        .start_timer(app, mode, duration, session_id, task_id)
        .await
}

/// 暂停番茄钟计时器
#[tauri::command]
async fn pause_pomo_timer(app: tauri::AppHandle) -> Result<(), String> {
    let manager = pomo_timer::get_timer_manager(&app);
    manager.pause_timer(app).await
}

/// 恢复番茄钟计时器
#[tauri::command]
async fn resume_pomo_timer(app: tauri::AppHandle) -> Result<(), String> {
    let manager = pomo_timer::get_timer_manager(&app);
    manager.resume_timer(app).await
}

/// 停止番茄钟计时器
#[tauri::command]
async fn stop_pomo_timer(app: tauri::AppHandle) -> Result<PomoTimerData, String> {
    let manager = pomo_timer::get_timer_manager(&app);
    Ok(manager.stop_timer(&app).await)
}

/// 获取番茄钟计时器状态
#[tauri::command]
async fn get_pomo_timer_state(app: tauri::AppHandle) -> Result<PomoTimerData, String> {
    let manager = pomo_timer::get_timer_manager(&app);
    Ok(manager.get_data().await)
}

/// 取出上次计时的记录（取完即清空），用于「进程被杀」后的补记：
/// 已过点 → 前端按正常完成收尾；未过点 → 前端按残留会话收尾。
///
/// 只在计时器处于 Idle 时才查（页面刷新时后端还在跑，不该动这份记录）。
#[tauri::command]
async fn take_pending_pomo_completion(
    app: tauri::AppHandle,
) -> Result<Option<pomo_native::PendingCompletion>, String> {
    let manager = pomo_timer::get_timer_manager(&app);
    if manager.get_data().await.state != pomo_timer::TimerState::Idle {
        return Ok(None);
    }
    Ok(pomo_native::take_pending_completion(&app).await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 创建共享计时器数据，供 PomoTimerManager 和 Android BackgroundService 共用
    let timer_data = Arc::new(tokio::sync::RwLock::new(PomoTimerData::default()));

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init());

    // Android 端：注册 BackgroundService 插件（必须在 notification 之后）
    #[cfg(target_os = "android")]
    let builder = builder.plugin(
        tauri_plugin_background_service::init_with_service(|| PomoBackgroundService)
    );

    // Android 端：注册原生能力插件（partial wake lock + 到点提醒通知）。
    // 只由 Rust 侧调用，前端不需要 capability 授权。
    #[cfg(target_os = "android")]
    let builder = builder.plugin(pomo_native::init());

    builder
        .invoke_handler(tauri::generate_handler![
            greet,
            start_pomo_timer,
            pause_pomo_timer,
            resume_pomo_timer,
            stop_pomo_timer,
            get_pomo_timer_state,
            take_pending_pomo_completion,
            llm::get_llm_settings,
            llm::set_llm_settings,
            llm::test_llm_connection,
            llm::llm_chat,
        ])
        .setup(move |app| {
            // 使用共享数据初始化计时器管理器
            let manager = Arc::new(PomoTimerManager::from_data(timer_data.clone()));
            app.manage(manager);

            // 托管共享数据，供 Android BackgroundService run() 读取
            app.manage(timer_data.clone());

            // 说明：从后台恢复时不再依赖事件通知 ——
            // 旧的 `app.listen("AppEvent::Resumed")` 监听的事件名在 tauri 2.10 里根本不存在（从不触发）；
            // 现在 `time_left` 由截止时间戳重算，并且前端在页面重新可见时会主动拉取权威快照，
            // 所以「回到前台即自愈」不依赖任何生命周期钩子。

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

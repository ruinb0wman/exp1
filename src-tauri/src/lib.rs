use tauri::Manager;
#[cfg(mobile)]
use tauri::{Emitter, Listener};
use std::sync::Arc;

mod pomo_timer;
use pomo_timer::{PomoTimerManager, PomoMode, PomoTimerData};

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
) -> Result<(), String> {
    let mode = match mode.as_str() {
        "focus" => PomoMode::Focus,
        "shortBreak" => PomoMode::ShortBreak,
        "longBreak" => PomoMode::LongBreak,
        _ => return Err("无效的模式".to_string()),
    };
    let manager = pomo_timer::get_timer_manager(&app);
    manager.start_timer(app, mode, duration, session_id).await
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
    Ok(manager.stop_timer().await)
}

/// 获取番茄钟计时器状态
#[tauri::command]
async fn get_pomo_timer_state(app: tauri::AppHandle) -> Result<PomoTimerData, String> {
    let manager = pomo_timer::get_timer_manager(&app);
    Ok(manager.get_data().await)
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

    builder
        .invoke_handler(tauri::generate_handler![
            greet,
            start_pomo_timer,
            pause_pomo_timer,
            resume_pomo_timer,
            stop_pomo_timer,
            get_pomo_timer_state,
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

            // 移动端：监听应用恢复事件，同步计时器状态
            #[cfg(mobile)]
            {
                let app_handle = app.handle().clone();
                app.listen("AppEvent::Resumed", move |_event| {
                    let _ = app_handle.emit("app:resumed", ());
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

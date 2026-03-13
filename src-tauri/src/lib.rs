use tauri::Manager;
use std::sync::Arc;

mod pomo_timer;
use pomo_timer::{PomoTimerManager, PomoMode, PomoTimerData};

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

/// 处理单例模式：当第二个实例启动时，聚焦到已存在的窗口
fn handle_single_instance(app: &tauri::AppHandle, _args: Vec<String>, _cwd: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        // 单例模式插件：确保只有一个应用实例运行
        .plugin(tauri_plugin_single_instance::init(handle_single_instance))
        .invoke_handler(tauri::generate_handler![
            greet,
            start_pomo_timer,
            pause_pomo_timer,
            resume_pomo_timer,
            stop_pomo_timer,
            get_pomo_timer_state,
        ])
        // 只在桌面端设置托盘
        .setup(|app| {
            // 初始化番茄钟计时器管理器
            let manager = Arc::new(PomoTimerManager::new());
            app.manage(manager);
            
            #[cfg(desktop)]
            setup_tray(app)?;
            Ok(())
        })
        // 只在桌面端阻止窗口关闭
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 设置系统托盘（仅桌面端）
#[cfg(desktop)]
fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};

    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

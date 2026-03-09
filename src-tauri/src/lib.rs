use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        // 单例模式插件：确保只有一个应用实例运行
        .plugin(tauri_plugin_single_instance::init(handle_single_instance))
        .invoke_handler(tauri::generate_handler![greet])
        // 只在桌面端设置托盘
        .setup(|app| {
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

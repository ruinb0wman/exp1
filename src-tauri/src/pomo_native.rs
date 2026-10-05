//! 番茄钟的原生能力（Android）：partial wake lock + 到点提醒通知。
//!
//! 为什么需要唤醒锁：前台服务只保证「进程不被杀」，**不保证 CPU 不睡**。灭屏后设备进入
//! suspend，`Instant`（CLOCK_MONOTONIC）不再前进 —— 只靠 tokio 定时器的话倒计时会整个停摆。
//!
//! 为什么由 Rust 驱动而不是 JS：计时状态的真身在 [`crate::pomo_timer`]（start/pause/resume/
//! stop/完成都在那里发生），从这里直接调原生最不容易漏；也避免为 JS 再开一条带 capability
//! 授权的 IPC 通道。非 Android 平台上所有函数都是空操作，保证任何平台都能 `cargo check`。

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[cfg(target_os = "android")]
use tauri::{Emitter, Manager};

/// 唤醒锁在「预计需要的时间」之外多留的余量（毫秒）。
///
/// 两个用途：① 到点自然结束时不必显式释放，把这段时间留给前端做 DB 收尾（进程被冻结/调度
/// 延迟时也不会在收尾前断电）② 万一某条 release 路径漏了，系统按超时兜底自动释放。
pub const WAKE_LOCK_GRACE_MS: u64 = 60_000;

#[cfg(target_os = "android")]
const PLUGIN_PACKAGE: &str = "com.ruinb0w.exp1";
#[cfg(target_os = "android")]
const PLUGIN_CLASS: &str = "PomoNativePlugin";

/// Android：注册原生插件（Kotlin 侧 `PomoNativePlugin`）并把 PluginHandle 托管进应用状态。
#[cfg(target_os = "android")]
pub fn init<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
	tauri::plugin::Builder::new("pomo-native")
		.setup(|app, api| {
			let plugin = api
				.register_android_plugin(PLUGIN_PACKAGE, PLUGIN_CLASS)
				.map_err(|e| e.to_string())?;
			app.manage(NativeHandle::<R> { plugin });
			Ok(())
		})
		.build()
}

#[cfg(target_os = "android")]
struct NativeHandle<R: tauri::Runtime> {
	plugin: tauri::plugin::PluginHandle<R>,
}

/// 把失败同时送到前端（`pomo:native-error`，可在 devtools 里看到）和 stdout。
///
/// 之前这类失败全是静默 `catch {}`，正是「倒计时悄悄停掉却查不出原因」的成因之一。
#[cfg(target_os = "android")]
fn report_error(app: &AppHandle, message: String) {
	println!("[pomo-native] {message}");
	let _ = app.emit("pomo:native-error", message);
}

#[cfg(not(target_os = "android"))]
#[allow(dead_code)]
fn report_error(_app: &AppHandle, message: String) {
	println!("[pomo-native] {message}");
}

/// 起阵完成时由原生补记的一条记录（进程在倒计时期间被系统杀掉时才有内容）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingCompletion {
	pub session_id: i64,
	#[serde(default)]
	pub task_id: Option<String>,
	pub mode: String,
	/// 设定时长（秒）；到点即视为跑完，所以这就是实际时长
	pub total_time: i64,
	/// 到点时刻（Unix 毫秒）
	pub trigger_at_ms: u64,
	/// 已过点 = 那次番茄钟真的跑完了；false 表示中途被打断（按残留会话处理）
	pub completed: bool,
}

/// 到点提醒的文案（title, body）。
pub fn completion_text(mode_label: &str) -> (String, String) {
	let title = "番茄钟".to_string();
	let body = if mode_label == "focus" {
		"\u{1f345} 专注完成！".to_string()
	} else {
		"\u{2615} 休息结束".to_string()
	};
	(title, body)
}

/// 申请 partial wake lock；`timeout_ms` 到期后由系统自动释放。
/// 重复调用是幂等的：原生侧会先释放再按新超时重新计时。
pub async fn acquire_wake_lock(app: &AppHandle, timeout_ms: u64) {
	#[cfg(target_os = "android")]
	{
		#[derive(serde::Serialize)]
		#[serde(rename_all = "camelCase")]
		struct Args {
			timeout_ms: u64,
		}

		let Some(state) = app.try_state::<NativeHandle<tauri::Wry>>() else {
			report_error(app, "原生插件未注册，跳过 wake lock".into());
			return;
		};
		if let Err(e) = state
			.plugin
			.run_mobile_plugin_async::<()>("acquireWakeLock", Args { timeout_ms })
			.await
		{
			report_error(app, format!("申请 wake lock 失败: {e}"));
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = (app, timeout_ms);
	}
}

/// 释放 partial wake lock（未持有时忽略）。
pub async fn release_wake_lock(app: &AppHandle) {
	#[cfg(target_os = "android")]
	{
		let Some(state) = app.try_state::<NativeHandle<tauri::Wry>>() else {
			return;
		};
		if let Err(e) = state
			.plugin
			.run_mobile_plugin_async::<()>("releaseWakeLock", ())
			.await
		{
			report_error(app, format!("释放 wake lock 失败: {e}"));
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = app;
	}
}

/// 到点提醒：应用不在前台时发一条高优先级 + 声音的通知（前台由前端播提示音，不重复打扰）。
/// 前台判断在原生侧做（插件订阅 Activity 生命周期），Rust 无需知道。
pub async fn notify_completion(app: &AppHandle, title: &str, body: &str) {
	#[cfg(target_os = "android")]
	{
		#[derive(serde::Serialize)]
		#[serde(rename_all = "camelCase")]
		struct Args<'a> {
			title: &'a str,
			body: &'a str,
		}

		let Some(state) = app.try_state::<NativeHandle<tauri::Wry>>() else {
			return;
		};
		if let Err(e) = state
			.plugin
			.run_mobile_plugin_async::<()>("notifyCompletion", Args { title, body })
			.await
		{
			report_error(app, format!("发送完成提醒失败: {e}"));
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = (app, title, body);
	}
}

/// 设定「到点」精确闹钟。
///
/// 这是**唯一**能保证灭屏/被系统冻结时也准点提醒的机制：部分定制 ROM（实测 OriginOS）
/// 会在灭屏约 30 秒后冻结应用并禁用其 wake lock，进程内的 tokio 定时器届时完全停摆。
/// 闹钟到点时系统会唤醒设备、拉起进程执行原生侧的 PomoAlarmReceiver，
/// 顺带也把我们的定时器线程解冻，让它把这次计时正常收尾。
#[allow(clippy::too_many_arguments)]
pub async fn set_completion_alarm(
	app: &AppHandle,
	trigger_at_ms: u64,
	session_id: Option<i64>,
	task_id: Option<&str>,
	mode_label: &str,
	total_time: i64,
	title: &str,
	body: &str,
) {
	#[cfg(target_os = "android")]
	{
		#[derive(serde::Serialize)]
		#[serde(rename_all = "camelCase")]
		struct Args<'a> {
			trigger_at_ms: u64,
			session_id: i64,
			task_id: Option<&'a str>,
			mode: &'a str,
			total_time: i64,
			title: &'a str,
			body: &'a str,
		}

		let Some(state) = app.try_state::<NativeHandle<tauri::Wry>>() else {
			return;
		};
		let args = Args {
			trigger_at_ms,
			session_id: session_id.unwrap_or(-1),
			task_id,
			mode: mode_label,
			total_time,
			title,
			body,
		};
		if let Err(e) = state
			.plugin
			.run_mobile_plugin_async::<()>("setCompletionAlarm", args)
			.await
		{
			report_error(app, format!("设定到点闹钟失败: {e}"));
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = (app, trigger_at_ms, session_id, task_id, mode_label, total_time, title, body);
	}
}

/// 取消到点闹钟（暂停 / 手动停止时调用）。
pub async fn cancel_completion_alarm(app: &AppHandle) {
	#[cfg(target_os = "android")]
	{
		let Some(state) = app.try_state::<NativeHandle<tauri::Wry>>() else {
			return;
		};
		if let Err(e) = state
			.plugin
			.run_mobile_plugin_async::<()>("cancelCompletionAlarm", ())
			.await
		{
			report_error(app, format!("取消到点闹钟失败: {e}"));
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = app;
	}
}

/// 清除「待补记」标记（Rust 侧正常完成时调用，避免下次启动重复结算）。
pub async fn clear_pending_completion(app: &AppHandle) {
	#[cfg(target_os = "android")]
	{
		let Some(state) = app.try_state::<NativeHandle<tauri::Wry>>() else {
			return;
		};
		if let Err(e) = state
			.plugin
			.run_mobile_plugin_async::<()>("clearPendingCompletion", ())
			.await
		{
			report_error(app, format!("清除待补记标记失败: {e}"));
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = app;
	}
}

/// 取出（并清空）「上次计时」的记录 —— 进程被杀时用它判断是否该补记。
pub async fn take_pending_completion(app: &AppHandle) -> Option<PendingCompletion> {
	#[cfg(target_os = "android")]
	{
		let state = app.try_state::<NativeHandle<tauri::Wry>>()?;
		match state
			.plugin
			.run_mobile_plugin_async::<Option<PendingCompletion>>("takePendingCompletion", ())
			.await
		{
			Ok(pending) => pending,
			Err(e) => {
				report_error(app, format!("读取待补记记录失败: {e}"));
				None
			}
		}
	}
	#[cfg(not(target_os = "android"))]
	{
		let _ = app;
		None
	}
}


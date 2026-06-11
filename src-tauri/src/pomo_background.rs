use std::sync::Arc;
use std::time::Duration;
use async_trait::async_trait;
use tauri::Manager;
use tauri_plugin_background_service::{BackgroundService, ServiceContext, ServiceError};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::RwLock;

use crate::pomo_timer::{PomoTimerData, TimerState, PomoMode};

const FGS_NOTIFICATION_ID: i32 = 9001;
const TITLE: &str = "\u{756a}\u{8304}\u{949f}";

fn format_remaining(seconds: i64) -> String {
	let hours = seconds / 3600;
	let mins = (seconds % 3600) / 60;
	let secs = seconds % 60;
	if hours > 0 {
		format!("{hours}:{mins:02}:{secs:02}")
	} else {
		format!("{mins:02}:{secs:02}")
	}
}

pub struct PomoBackgroundService;

#[async_trait]
impl<R: tauri::Runtime> BackgroundService<R> for PomoBackgroundService {
	async fn init(&mut self, _ctx: &ServiceContext<R>) -> Result<(), ServiceError> {
		Ok(())
	}

	async fn run(&mut self, ctx: &ServiceContext<R>) -> Result<(), ServiceError> {
		let mut ticker = tokio::time::interval(Duration::from_secs(1));
		let mut last_state = TimerState::Idle;

		loop {
			tokio::select! {
				_ = ctx.shutdown.cancelled() => break,
				_ = ticker.tick() => {
					if let Some(state) = ctx.app.try_state::<Arc<RwLock<PomoTimerData>>>() {
						let data = state.read().await;

						if data.state == TimerState::Running {
							// 每秒更新倒计时
							last_state = TimerState::Running;
							let body = format!("\u{5269}\u{4f59} {}", format_remaining(data.time_left));
							let _ = ctx.app.notification()
								.builder()
								.id(FGS_NOTIFICATION_ID)
								.title(TITLE)
								.body(&body)
								.show();
						} else if data.state != last_state {
							// 状态切换时更新一次
							last_state = data.state;
							let body = match data.state {
								TimerState::Paused => "\u{5df2}\u{6682}\u{505c}",
								TimerState::Idle => {
									if data.is_completed {
										match data.mode {
											PomoMode::Focus => "\u{1f345} \u{4e13}\u{6ce8}\u{5b8c}\u{6210}\u{ff01}",
											_ => "\u{2615} \u{4f11}\u{606f}\u{7ed3}\u{675f}",
										}
									} else {
										"\u{5df2}\u{505c}\u{6b62}"
									}
								}
								_ => continue,
							};
							let _ = ctx.app.notification()
								.builder()
								.id(FGS_NOTIFICATION_ID)
								.title(TITLE)
								.body(body)
								.show();
						}
					}
				}
			}
		}

		Ok(())
	}
}

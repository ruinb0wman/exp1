use std::sync::Arc;
use std::time::Duration;
use async_trait::async_trait;
use tauri::Manager;
use tauri_plugin_background_service::{BackgroundService, ServiceContext, ServiceError};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::RwLock;

use crate::pomo_timer::{state_body, PomoMode, PomoTimerData, TimerState, NOTIFICATION_TITLE};

const FGS_NOTIFICATION_ID: i32 = 9001;

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
							let body = format!("Remaining {}", format_remaining(data.time_left));
							let _ = ctx.app.notification()
								.builder()
								.id(FGS_NOTIFICATION_ID)
								.title(NOTIFICATION_TITLE)
								.body(&body)
								.show();
						} else if data.state != last_state {
							// 状态切换时更新一次
							last_state = data.state;
							let body = match state_body(data.state, data.is_completed, data.mode) {
								Some(body) => body,
								None => continue,
							};
							let _ = ctx.app.notification()
								.builder()
								.id(FGS_NOTIFICATION_ID)
								.title(NOTIFICATION_TITLE)
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

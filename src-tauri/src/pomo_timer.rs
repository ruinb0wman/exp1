use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{Mutex, RwLock};
use tokio::time::interval;
use serde::{Serialize, Deserialize};

/// 番茄钟模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PomoMode {
    Focus,
    ShortBreak,
    LongBreak,
}

/// 计时器状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimerState {
    Idle,
    Running,
    Paused,
}

/// 番茄钟计时器数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomoTimerData {
    pub state: TimerState,
    pub mode: PomoMode,
    pub time_left: i64,
    pub total_time: i64,
    pub session_id: Option<i64>,
}

impl Default for PomoTimerData {
    fn default() -> Self {
        Self {
            state: TimerState::Idle,
            mode: PomoMode::Focus,
            time_left: 25 * 60, // 默认25分钟
            total_time: 25 * 60,
            session_id: None,
        }
    }
}

/// 番茄钟计时器管理器
pub struct PomoTimerManager {
    data: Arc<RwLock<PomoTimerData>>,
    cancel_token: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl PomoTimerManager {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(PomoTimerData::default())),
            cancel_token: Arc::new(Mutex::new(None)),
        }
    }

    /// 获取当前计时器数据
    pub async fn get_data(&self) -> PomoTimerData {
        self.data.read().await.clone()
    }

    /// 启动计时器
    pub async fn start_timer(
        &self,
        app_handle: AppHandle,
        mode: PomoMode,
        duration: i64,
        session_id: Option<i64>,
    ) -> Result<(), String> {
        // 先停止现有的计时器
        self.stop_timer().await;

        // 更新计时器数据
        {
            let mut data = self.data.write().await;
            data.mode = mode;
            data.time_left = duration;
            data.total_time = duration;
            data.state = TimerState::Running;
            data.session_id = session_id;
        }

        // 创建取消令牌
        let (tx, rx) = tokio::sync::oneshot::channel();
        {
            let mut token = self.cancel_token.lock().await;
            *token = Some(tx);
        }

        // 克隆 app_handle 用于后台任务
        let app_handle_clone = app_handle.clone();
        
        // 克隆 cancel_token 用于后台任务
        let cancel_token_clone = self.cancel_token.clone();
        
        // 启动后台任务
        let data_clone = self.data.clone();
        tokio::spawn(async move {
            run_timer_loop(app_handle_clone, data_clone, cancel_token_clone, rx).await;
        });

        // 发送状态更新事件
        let _ = app_handle.emit("pomo:state-changed", self.get_data().await);

        Ok(())
    }

    /// 暂停计时器
    pub async fn pause_timer(&self, app_handle: AppHandle) -> Result<(), String> {
        {
            let mut data = self.data.write().await;
            if data.state != TimerState::Running {
                return Err("计时器未在运行".to_string());
            }
            data.state = TimerState::Paused;
        }

        // 发送状态更新事件
        let _ = app_handle.emit("pomo:state-changed", self.get_data().await);

        Ok(())
    }

    /// 恢复计时器
    pub async fn resume_timer(&self, app_handle: AppHandle) -> Result<(), String> {
        {
            let mut data = self.data.write().await;
            if data.state != TimerState::Paused {
                return Err("计时器未暂停".to_string());
            }
            data.state = TimerState::Running;
        }

        // 发送状态更新事件
        let _ = app_handle.emit("pomo:state-changed", self.get_data().await);

        Ok(())
    }

    /// 停止计时器
    pub async fn stop_timer(&self) -> PomoTimerData {
        // 发送取消信号
        {
            let mut token = self.cancel_token.lock().await;
            if let Some(tx) = token.take() {
                let _ = tx.send(());
            }
        }

        // 重置计时器数据
        let final_data = {
            let mut data = self.data.write().await;
            let final_data = data.clone();
            data.state = TimerState::Idle;
            data.time_left = data.total_time;
            final_data
        };

        final_data
    }

}

/// 计时器主循环
async fn run_timer_loop(
    app_handle: AppHandle,
    data: Arc<RwLock<PomoTimerData>>,
    cancel_token: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    mut cancel_rx: tokio::sync::oneshot::Receiver<()>,
) {
    let mut ticker = interval(Duration::from_secs(1));

    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                // 收到取消信号，退出循环
                break;
            }
            _ = ticker.tick() => {
                // 每秒检查一次
                let should_continue = tick(&app_handle, &data, &cancel_token).await;
                if !should_continue {
                    break;
                }
            }
        }
    }
}

/// 每秒执行一次
async fn tick(app_handle: &AppHandle, data: &Arc<RwLock<PomoTimerData>>, cancel_token: &Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>) -> bool {
    let mut data_guard = data.write().await;

    // 如果计时器被暂停或已经处于 Idle 状态，不更新时间
    if data_guard.state != TimerState::Running {
        return true;
    }

    // 防止 time_left 已经是 0 或负数时继续减
    if data_guard.time_left <= 0 {
        // 状态异常，停止计时器
        data_guard.state = TimerState::Idle;
        drop(data_guard);
        return false;
    }

    // 减少剩余时间
    data_guard.time_left -= 1;

    // 发送时间更新事件
    let _ = app_handle.emit("pomo:tick", data_guard.clone());

    // 检查是否完成
    if data_guard.time_left <= 0 {
        // 计时完成
        let mode = data_guard.mode;
        let session_id = data_guard.session_id;
        
        // 重置状态为 Idle
        data_guard.state = TimerState::Idle;
        data_guard.time_left = 0; // 确保显示为 0，而不是重置为 total_time
        
        // 清除取消令牌，防止重复停止
        drop(data_guard);
        {
            let mut token = cancel_token.lock().await;
            *token = None;
        }

        // 发送完成事件
        let _ = app_handle.emit("pomo:completed", PomoCompletedEvent {
            mode,
            session_id,
        });

        // 发送系统通知
        send_completion_notification(app_handle, mode);

        return false; // 停止计时器循环
    }

    true // 继续计时
}

/// 计时完成事件
#[derive(Debug, Clone, Serialize)]
struct PomoCompletedEvent {
    mode: PomoMode,
    session_id: Option<i64>,
}

/// 发送完成通知
fn send_completion_notification(app_handle: &AppHandle, mode: PomoMode) {
    use tauri_plugin_notification::NotificationExt;

    let (title, body) = match mode {
        PomoMode::Focus => (
            "🍅 专注完成！",
            "恭喜完成一个番茄钟，休息一下吧~"
        ),
        _ => (
            "☕ 休息结束",
            "休息结束，准备开始新的专注吧！"
        ),
    };

    // 发送通知
    let notification = app_handle.notification();
    let _ = notification.builder()
        .title(title)
        .body(body)
        .show();
}

/// 获取全局计时器管理器
pub fn get_timer_manager(app_handle: &AppHandle) -> Arc<PomoTimerManager> {
    if let Some(manager) = app_handle.try_state::<Arc<PomoTimerManager>>() {
        return manager.inner().clone();
    }
    
    let manager = Arc::new(PomoTimerManager::new());
    app_handle.manage(manager.clone());
    manager
}

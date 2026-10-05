use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{Mutex, RwLock};
use tokio::time::{interval, MissedTickBehavior};
use serde::{Serialize, Deserialize};

use crate::pomo_native;

/// 当前 Unix 时间戳（毫秒）。
///
/// 必须用 epoch（RTC / CLOCK_REALTIME）而不是 `Instant`（CLOCK_MONOTONIC）：
/// 设备 suspend（灭屏深睡）期间单调时钟不前进，用它算的倒计时会跟着停摆。
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 由截止时间戳重算剩余秒数：向上取整（避免提前显示 0），并钳在 `[0, total_time]`。
fn remaining_secs(ends_at_ms: u64, total_time: i64, now: u64) -> i64 {
    let remain_ms = ends_at_ms.saturating_sub(now);
    let secs = ((remain_ms + 999) / 1000) as i64;
    secs.clamp(0, total_time.max(0))
}

/// 按截止时间戳刷新 `time_left`；`ends_at_ms` 缺失时用现有 `time_left` 自愈补上。
fn sync_time_left(data: &mut PomoTimerData, now: u64) {
    if data.state != TimerState::Running {
        return;
    }
    let Some(ends_at_ms) = data.ends_at_ms else {
        // 理论上不会出现（start/resume 都会写），兜底自愈，避免计时永远卡住
        data.ends_at_ms = Some(now + data.time_left.max(0) as u64 * 1000);
        return;
    };
    data.time_left = remaining_secs(ends_at_ms, data.total_time, now);
}

/// 唤醒锁超时 = 本次计时还需要的时长 + 余量（详见 [`pomo_native::WAKE_LOCK_GRACE_MS`]）。
fn wake_lock_timeout_ms(remaining_secs: i64) -> u64 {
    remaining_secs.max(0) as u64 * 1000 + pomo_native::WAKE_LOCK_GRACE_MS
}

/// 与前端 / 原生侧一致的模式名（用于落盘与通知文案）。
fn mode_label(mode: PomoMode) -> &'static str {
    match mode {
        PomoMode::Focus => "focus",
        PomoMode::ShortBreak => "shortBreak",
        PomoMode::LongBreak => "longBreak",
    }
}

/// 安排「到点」闹钟（唯一能在灭屏/被冻结时准点提醒的机制，详见 [`pomo_native::set_completion_alarm`]）。
async fn schedule_completion_alarm(
    app_handle: &AppHandle,
    ends_at_ms: u64,
    session_id: Option<i64>,
    task_id: Option<&str>,
    mode: PomoMode,
    total_time: i64,
) {
    let label = mode_label(mode);
    let (title, body) = pomo_native::completion_text(label);
    pomo_native::set_completion_alarm(
        app_handle,
        ends_at_ms,
        session_id,
        task_id,
        label,
        total_time,
        &title,
        &body,
    )
    .await;
}

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
    /// 本次计时的截止时间（Unix 毫秒）。Running 时才有值，pause/stop/完成时清空。
    /// 剩余时间一律由它推算，而不是逐 tick 递减。
    pub ends_at_ms: Option<u64>,
    pub session_id: Option<i64>,
    /// 关联的任务实例 ID（随完成记录一起落盘，供「进程被杀后补记」使用）
    pub task_id: Option<String>,
    pub is_completed: bool,
}

impl Default for PomoTimerData {
    fn default() -> Self {
        Self {
            state: TimerState::Idle,
            mode: PomoMode::Focus,
            time_left: 25 * 60, // 默认25分钟
            total_time: 25 * 60,
            ends_at_ms: None,
            session_id: None,
            task_id: None,
            is_completed: false,
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

    /// 使用外部共享数据构造（Android 端与 BackgroundService 共享状态）
    pub fn from_data(data: Arc<RwLock<PomoTimerData>>) -> Self {
        Self {
            data,
            cancel_token: Arc::new(Mutex::new(None)),
        }
    }

    /// 获取当前计时器数据（权威快照）。
    ///
    /// 返回前会按截止时间戳刷新 `time_left`：即使灭屏期间一个 tick 都没跑，
    /// 应用恢复后第一眼拿到的也是正确剩余时间。
    pub async fn get_data(&self) -> PomoTimerData {
        let mut data = self.data.write().await;
        sync_time_left(&mut data, now_ms());
        data.clone()
    }

    /// 启动计时器
    pub async fn start_timer(
        &self,
        app_handle: AppHandle,
        mode: PomoMode,
        duration: i64,
        session_id: Option<i64>,
        task_id: Option<String>,
    ) -> Result<(), String> {
        // 先停止现有的计时器
        self.stop_timer(&app_handle).await;

        // 更新计时器数据（截止时间戳是唯一的时间真身）
        let ends_at_ms = {
            let mut data = self.data.write().await;
            data.mode = mode;
            data.time_left = duration;
            data.total_time = duration;
            data.ends_at_ms = Some(now_ms() + duration.max(0) as u64 * 1000);
            data.state = TimerState::Running;
            data.session_id = session_id;
            data.task_id = task_id.clone();
            data.is_completed = false;
            data.ends_at_ms.unwrap_or(0)
        };

        // 计时期间必须持 partial wake lock：否则灭屏 suspend 后定时器会整个停摆
        pomo_native::acquire_wake_lock(&app_handle, wake_lock_timeout_ms(duration)).await;

        // 到点闹钟：被系统冻结/杀掉时也能准点提醒（并将进程唤醒解冻）
        schedule_completion_alarm(
            &app_handle,
            ends_at_ms,
            session_id,
            task_id.as_deref(),
            mode,
            duration,
        )
        .await;

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
            // 先把截止时间换算成剩余秒数再清空：暂停期间不需要唤醒锁
            sync_time_left(&mut data, now_ms());
            data.ends_at_ms = None;
            data.state = TimerState::Paused;
        }

        pomo_native::release_wake_lock(&app_handle).await;
        // 暂停期间不该响，撤掉到点闹钟
        pomo_native::cancel_completion_alarm(&app_handle).await;

        // 发送状态更新事件
        let _ = app_handle.emit("pomo:state-changed", self.get_data().await);

        Ok(())
    }

    /// 恢复计时器
    pub async fn resume_timer(&self, app_handle: AppHandle) -> Result<(), String> {
        let (remaining, ends_at_ms, session_id, task_id, mode, total_time) = {
            let mut data = self.data.write().await;
            if data.state != TimerState::Paused {
                return Err("计时器未暂停".to_string());
            }
            data.state = TimerState::Running;
            data.ends_at_ms = Some(now_ms() + data.time_left.max(0) as u64 * 1000);
            (
                data.time_left,
                data.ends_at_ms.unwrap_or(0),
                data.session_id,
                data.task_id.clone(),
                data.mode,
                data.total_time,
            )
        };

        // 暂停时已释放，恢复要重新持锁（超时按新的剩余时间重算）
        pomo_native::acquire_wake_lock(&app_handle, wake_lock_timeout_ms(remaining)).await;
        // 到点闹钟也要按新的截止时间重排
        schedule_completion_alarm(
            &app_handle,
            ends_at_ms,
            session_id,
            task_id.as_deref(),
            mode,
            total_time,
        )
        .await;

        // 发送状态更新事件
        let _ = app_handle.emit("pomo:state-changed", self.get_data().await);

        Ok(())
    }

    /// 停止计时器
    pub async fn stop_timer(&self, app_handle: &AppHandle) -> PomoTimerData {
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
            data.ends_at_ms = None;
            final_data
        };

        // 手动停止后不需要唤醒锁，到点闹钟也一并撤掉
        pomo_native::release_wake_lock(app_handle).await;
        pomo_native::cancel_completion_alarm(app_handle).await;

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
    // 默认的 Burst 会在长时间挂起/冻结后一次性补发一串 tick（前端会看到时间瞬间跳变）；
    // 正确性已由截止时间戳保证，这里只需要「顺延」。
    ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

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

    // 关键：剩余时间由截止时间戳重算，而不是逐 tick 递减。
    // 这样即使中间漏了 tick（进程被冻结、设备 suspend、调度延迟），第一拍就自愈。
    sync_time_left(&mut data_guard, now_ms());

    // 发送时间更新事件
    let _ = app_handle.emit("pomo:tick", data_guard.clone());

    // 检查是否完成
    if data_guard.time_left <= 0 {
        // 计时完成
        let mode = data_guard.mode;
        let session_id = data_guard.session_id;
        let elapsed = data_guard.total_time;

        // 重置状态为 Idle
        data_guard.state = TimerState::Idle;
        data_guard.time_left = 0; // 确保显示为 0，而不是重置为 total_time
        data_guard.ends_at_ms = None;
        data_guard.is_completed = true;

        // 清除取消令牌，防止重复停止
        drop(data_guard);
        {
            let mut token = cancel_token.lock().await;
            *token = None;
        }

        // 发送完成事件（elapsed 由后端给出，前端不要再用 total - timeLeft 反推）
        let _ = app_handle.emit("pomo:completed", PomoCompletedEvent {
            mode,
            session_id,
            elapsed,
        });

        // 灭屏/后台时由原生补一条带声音的通知（前台由前端播提示音，不重复打扰）
        let (title, body) = pomo_native::completion_text(mode_label(mode));
        pomo_native::notify_completion(app_handle, &title, &body).await;
        // 闹钟若已写过「待补记」，这里正常完成 → 清掉，避免下次启动重复结算
        pomo_native::clear_pending_completion(app_handle).await;

        // 注意：这里不显式释放 wake lock —— 让它在超时余量内继续持有，
        // 保证前端把这次完成写进 DB（会话/任务进度/积分）时 CPU 不会睡过去。

        return false; // 停止计时器循环
    }

    true // 继续计时
}

/// 计时完成事件
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PomoCompletedEvent {
    mode: PomoMode,
    session_id: Option<i64>,
    /// 实际计时时长（秒），由后端给出，避免前端反推在漏 tick 时算少
    elapsed: i64,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn data(state: TimerState, time_left: i64, total_time: i64, ends_at_ms: Option<u64>) -> PomoTimerData {
        PomoTimerData {
            state,
            mode: PomoMode::Focus,
            time_left,
            total_time,
            ends_at_ms,
            session_id: None,
            task_id: None,
            is_completed: false,
        }
    }

    /// 剩余秒数：向上取整（还剩 0.4s 也要显示 1s）
    #[test]
    fn remaining_secs_rounds_up() {
        assert_eq!(remaining_secs(10_000, 60, 0), 10);
        assert_eq!(remaining_secs(10_400, 60, 0), 11);
        assert_eq!(remaining_secs(10_001, 60, 0), 11);
        assert_eq!(remaining_secs(10_000, 60, 10_000), 0);
    }

    /// 剩余秒数钳在 [0, total_time]（防用户改系统时间造成负值/超总时长）
    #[test]
    fn remaining_secs_is_clamped() {
        assert_eq!(remaining_secs(0, 60, 10_000), 0);
        assert_eq!(remaining_secs(u64::MAX, 60, 1_000), 60);
    }

    /// 核心：即使漏了一堆 tick（灭屏 suspend / 进程被冻结），也从截止时间戳重算回来
    #[test]
    fn sync_time_left_recovers_from_missed_ticks() {
        // 截止时间戳 60_000_000ms；假设这期间一个 tick 都没跑，
        // 当前已经走到「截止前 90 秒」→ 应重算成 90 秒（而不是停在原来的 1500）
        let mut session = data(TimerState::Running, 1500, 1500, Some(60_000_000));

        sync_time_left(&mut session, 60_000_000 - 90_000);
        assert_eq!(session.time_left, 90);

        // 截止时间已过 → 归零（由 tick 负责收尾）
        sync_time_left(&mut session, 60_000_000 + 5_000);
        assert_eq!(session.time_left, 0);
    }

    /// Paused / Idle 不参与重算（暂停期间 time_left 就是真身）
    #[test]
    fn sync_time_left_skips_non_running_states() {
        let mut paused = data(TimerState::Paused, 300, 1500, None);
        sync_time_left(&mut paused, 999_999_999_999);
        assert_eq!(paused.time_left, 300);
        assert!(paused.ends_at_ms.is_none());
    }

    /// ends_at_ms 缺失时自愈（避免计时永远卡死）
    #[test]
    fn sync_time_left_self_heals_missing_deadline() {
        let mut session = data(TimerState::Running, 120, 1500, None);
        sync_time_left(&mut session, 1_000);
        assert_eq!(session.ends_at_ms, Some(1_000 + 120_000));
        assert_eq!(session.time_left, 120);

        // 自愈后按新的截止时间戳正常递减
        sync_time_left(&mut session, 1_000 + 30_000);
        assert_eq!(session.time_left, 90);
    }

    /// 唤醒锁超时 = 剩余时长 + 余量
    #[test]
    fn wake_lock_timeout_covers_duration_plus_grace() {
        assert_eq!(wake_lock_timeout_ms(1500), 1_500_000 + pomo_native::WAKE_LOCK_GRACE_MS);
        assert_eq!(wake_lock_timeout_ms(-5), pomo_native::WAKE_LOCK_GRACE_MS);
    }
}

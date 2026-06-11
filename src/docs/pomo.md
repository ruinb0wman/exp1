# Pomo 番茄钟系统文档

## 一、系统架构概览

```mermaid
flowchart TB
    subgraph Frontend["前端 React + Zustand"]
        PS[pomoStore\n状态管理 + DB 操作]
        UGPT[useGlobalPomoTimer\n桥接 Hook]
    end

    subgraph Rust["Rust 后端 — 所有平台"]
        PTM[PomoTimerManager\n计时器管理器]
        RTL[run_timer_loop\ntokio 1s 循环]
        TICK[tick\n每秒执行]
        CMDS[Tauri Commands\nstart/pause/resume/stop]
    end

    subgraph Android["Android 专用 — 前台服务保活"]
        PBS[PomoBackgroundService\nBackgroundService impl]
        FGN[前台通知\nID=9001]
    end

    subgraph DB["IndexedDB — Dexie.js"]
        SESS[PomoSession\n会话记录]
        SETT[PomoSettings\n用户设置]
    end

    User((用户操作)) -->|点击开始/暂停等| PS
    PS <-->|DB 读写| DB
    UGPT -->|invoke| CMDS
    CMDS -->|方法调用| PTM
    PTM -->|spawn| RTL
    RTL -->|每秒| TICK
    TICK -->|emit| UGPT

    UGPT -->|startService/stopService| PBS
    PBS -->|每秒读取共享状态| PTM
    PBS -->|更新| FGN
```

---

## 二、完整生命周期

### 2.1 计时启动

```mermaid
sequenceDiagram
    participant U as 用户
    participant PS as pomoStore
    participant UGPT as useGlobalPomoTimer
    participant CMD as Tauri Commands
    participant PTM as PomoTimerManager
    participant BS as PomoBackgroundService
    participant EVT as Events

    U->>PS: 点击「开始」
    PS->>PS: startTimer()
    PS->>DB: createPomoSession()
    PS-->>PS: isRunning=true, sessionId=xxx
    PS->>UGPT: state 变化触发 sync effect
    UGPT->>BS: ensureBackgroundService("番茄钟 25:00")
    BS->>BS: startService → 前台服务启动
    UGPT->>CMD: invoke start_pomo_timer
    CMD->>PTM: start_timer(mode, duration, sessionId)
    PTM->>PTM: stop_timer() (先停止旧计时器)
    PTM->>PTM: data.state=Running, is_completed=false
    PTM->>PTM: tokio::spawn run_timer_loop
    PTM->>EVT: emit pomo:state-changed
    EVT->>UGPT: listen → 同步前端状态
    UGPT->>PS: setState(isRunning, timeLeft, mode)
```

### 2.2 暂停 & 恢复

```mermaid
sequenceDiagram
    participant U as 用户
    participant PS as pomoStore
    participant UGPT as useGlobalPomoTimer
    participant CMD as Tauri Commands
    participant PTM as PomoTimerManager
    participant BS as PomoBackgroundService
    participant EVT as Events

    U->>PS: 点击「暂停」
    PS->>PS: pauseTimer() → isPaused=true
    UGPT->>CMD: invoke pause_pomo_timer
    CMD->>PTM: pause_timer()
    PTM->>PTM: data.state=Paused
    PTM->>EVT: emit pomo:state-changed
    EVT->>UGPT: listen → 同步前端

    Note over BS: 下一 tick 读到 Paused\n通知更新为"已暂停"

    U->>PS: 点击「恢复」
    PS->>PS: resumeTimer() → isPaused=false
    UGPT->>CMD: invoke resume_pomo_timer
    CMD->>PTM: resume_timer()
    PTM->>PTM: data.state=Running
    PTM->>EVT: emit pomo:state-changed
    EVT->>UGPT: listen → 同步前端
```

### 2.3 主动停止

```mermaid
sequenceDiagram
    participant U as 用户
    participant PS as pomoStore
    participant UGPT as useGlobalPomoTimer
    participant CMD as Tauri Commands
    participant PTM as PomoTimerManager
    participant BS as PomoBackgroundService

    U->>PS: 点击「停止」
    PS->>PS: stopTimer(false)
    PS->>DB: abortPomoSession()
    PS-->>PS: isRunning=false
    UGPT->>CMD: invoke stop_pomo_timer
    CMD->>PTM: stop_timer()
    PTM->>PTM: cancel oneshot → run_timer_loop 退出
    PTM->>PTM: data.state=Idle, time_left=total_time
    PTM-->>CMD: return final_data
    UGPT->>BS: stopBackgroundService()
    BS->>BS: stopService → 前台服务停止 → 通知消失
```

### 2.4 Tick 主循环 & 自然完成

```mermaid
flowchart TD
    START([run_timer_loop]) --> SELECT{tokio::select}
    SELECT -->|cancel_rx 收到| STOP[退出循环]
    SELECT -->|1s ticker| TICK[tick 函数]

    TICK --> CHECK_STATE{data.state == Running?}
    CHECK_STATE -->|否| CONT_RET[return true\n继续循环]

    CHECK_STATE -->|是| CHECK_ZERO{data.time_left <= 0?}
    CHECK_ZERO -->|是异常状态| IDLE_ERR[state=Idle\nreturn false]

    CHECK_ZERO -->|否| DECR[time_left -= 1]
    DECR --> EMIT_TICK[emit pomo:tick]

    EMIT_TICK --> CHECK_DONE{time_left <= 0?}
    CHECK_DONE -->|否| CONT_RET

    CHECK_DONE -->|是完成| DONE[计时完成]
    DONE --> SET_IDLE[state=Idle, time_left=0\nis_completed=true]
    SET_IDLE --> CLEAR_TOKEN[clear cancel_token\n防止重复停止]
    CLEAR_TOKEN --> EMIT_COMPLETED[emit pomo:completed]
    EMIT_COMPLETED --> NON_ANDROID{Android 平台?}

    NON_ANDROID -->|否| SEND_NOTIF[send_completion_notification]
    NON_ANDROID -->|是| SKIP[由前台通知处理]
    SEND_NOTIF --> EXIT_RET[return false\n退出循环]
    SKIP --> EXIT_RET
```

### 2.5 完成处理 & 自动切换

```mermaid
sequenceDiagram
    participant PTM as PomoTimerManager
    participant EVT as Events
    participant UGPT as useGlobalPomoTimer
    participant PS as pomoStore
    participant CMD as Tauri Commands
    participant BS as PomoBackgroundService

    PTM->>EVT: emit pomo:completed{mode, sessionId}
    EVT->>UGPT: listen → handleTimerComplete
    UGPT->>UGPT: isAutoSwitchingRef=true
    UGPT->>CMD: invoke stop_pomo_timer
    UGPT->>PS: stopTimer(true)
    PS->>DB: completePomoSession()
    PS->>PS: todayCount++

    alt autoStartBreaks + 专注完成
        UGPT->>PS: setMode(shortBreak/longBreak)
        alt autoStartPomos
            UGPT->>PS: setTimeout → startTimerStore()
            PS->>DB: createPomoSession()
            PS-->>PS: isRunning=true
            UGPT->>CMD: start_pomo_timer (新周期)
        else !autoStartPomos
            UGPT->>BS: stopBackgroundService()
            UGPT->>UGPT: isAutoSwitchingRef=false
        end
    else autoStartPomos + 休息结束
        UGPT->>PS: setMode(focus)
        UGPT->>PS: setTimeout → startTimerStore()
        PS->>DB: createPomoSession()
        PS-->>PS: isRunning=true
        UGPT->>CMD: start_pomo_timer (新周期)
    else 无自动切换
        UGPT->>BS: stopBackgroundService()
        UGPT->>UGPT: isAutoSwitchingRef=false
    end
```

---

## 三、Android 保活 & 通知系统

```mermaid
sequenceDiagram
    participant FE as 前端
    participant BS as PomoBackgroundService
    participant DATA as Arc RwLock PomoTimerData
    participant NOTIF as 前台通知 ID=9001

    FE->>BS: startService({ serviceLabel: "番茄钟 25:00" })
    BS->>BS: run() 启动 1s ticker
    loop 每秒
        BS->>DATA: try_state → 读取
        alt data.state == Running
            BS->>NOTIF: .id(9001).title("番茄钟").body("剩余 15:32")
            BS->>BS: last_state = Running
        else data.state == Paused && != last_state
            BS->>NOTIF: .id(9001).body("已暂停")
            BS->>BS: last_state = Paused
        else data.state == Idle && != last_state
            alt data.is_completed
                BS->>BS: match mode
                alt Focus
                    BS->>NOTIF: .body("🍅 专注完成！")
                else ShortBreak / LongBreak
                    BS->>NOTIF: .body("☕ 休息结束")
                end
            else
                BS->>NOTIF: .body("已停止")
            end
            BS->>BS: last_state = Idle
        end
    end
    FE->>BS: stopService()
    BS->>BS: ctx.shutdown 触发 → break → run() 退出
    BS->>NOTIF: 前台服务停止 → 通知自动消失
```

---

## 四、关键函数索引

| 函数 | 文件:行号 | 职责 |
|------|-----------|------|
| `PomoTimerManager::start_timer()` | `pomo_timer.rs:78` | 停止旧计时器，初始化 data，创建 cancel_token，spawn `run_timer_loop`。 |
| `PomoTimerManager::pause_timer()` | `pomo_timer.rs:125` | `data.state = Paused`，emit `pomo:state-changed`。 |
| `PomoTimerManager::resume_timer()` | `pomo_timer.rs:141` | `data.state = Running`，emit `pomo:state-changed`。 |
| `PomoTimerManager::stop_timer()` | `pomo_timer.rs:157` | 发 cancel 信号，重置 `state=Idle`, `time_left=total_time`。**不碰 `is_completed`**。 |
| `PomoTimerManager::get_data()` | `pomo_timer.rs:73` | 读取当前 `PomoTimerData` 快照。 |
| `PomoTimerManager::from_data()` | `pomo_timer.rs:65` | 使用外部 `Arc<RwLock<PomoTimerData>>` 构造（Android 共享）。 |
| `get_timer_manager()` | `pomo_timer.rs:294` | 从 managed state 获取或创建 `PomoTimerManager`（惰性初始化）。 |
| `run_timer_loop()` | `pomo_timer.rs:181` | `tokio::select!` 循环，等待 cancel 信号或每秒 tick。 |
| `tick()` | `pomo_timer.rs:207` | 每秒：检查状态 → 减 time_left → emit `pomo:tick` → 检测完成。 |
| `PomoBackgroundService::init()` | `pomo_background.rs:29` | 初始化回调，目前为空。 |
| `PomoBackgroundService::run()` | `pomo_background.rs:33` | 1s 循环，读取共享 data，用 `.id(9001)` 更新前台通知。 |
| `ensureBackgroundService()` | `useGlobalPomoTimer.ts:96` | 前端的 Android 保活启动封装，try-catch 兼容非 Android。 |
| `stopBackgroundService()` | `useGlobalPomoTimer.ts:107` | 前端的 Android 保活停止封装，try-catch 兼容非 Android。 |
| `handleTimerComplete()` | `useGlobalPomoTimer.ts:118` | 处理 `pomo:completed`：停止计时器、更新 DB、自动切换模式。 |
| `syncToBackend()` | `useGlobalPomoTimer.ts:249` | 同步前后端状态：启动/暂停/恢复/停止 + 保活生命周期管理。 |
| `startTimer()` (store) | `pomoStore.ts:139` | 创建 DB Session，设 `isRunning=true`。 |
| `stopTimer()` (store) | `pomoStore.ts:184` | 完成或中止 DB Session，更新 todayCount、任务进度。 |

---

## 五、事件表

| 事件名 | 方向 | 触发时机 | payload |
|--------|------|----------|---------|
| `pomo:tick` | Rust → 前端 | 每秒，正在运行时 | `{ timeLeft, totalTime, state, mode, sessionId }` |
| `pomo:state-changed` | Rust → 前端 | start/pause/resume/stop | `{ timeLeft, totalTime, state, mode, sessionId }` |
| `pomo:completed` | Rust → 前端 | time_left 归零 | `{ mode, sessionId }` |
| `app:resumed` | Rust → 前端 | 移动端从后台恢复 | 无 payload |

---

## 六、PomoTimerData 字段表

| 字段 | 类型 | 序列化 | 说明 | 写者 |
|------|------|--------|------|------|
| `state` | `TimerState` | `idle/running/paused` | 计时器状态 | `start_timer` = Running, `pause_timer` = Paused, `resume_timer` = Running, `tick`(完成) = Idle, `stop_timer` = Idle |
| `mode` | `PomoMode` | `focus/shortBreak/longBreak` | 当前模式 | `start_timer` |
| `time_left` | `i64` | seconds | 剩余秒数 | `start_timer` = duration, `tick` 每秒 -1, `tick`(完成) = 0, `stop_timer` = total_time |
| `total_time` | `i64` | seconds | 总时长 | `start_timer` = duration |
| `session_id` | `Option<i64>` | number/null | 数据库 Session ID | `start_timer` |
| `is_completed` | `bool` | true/false | 是否自然完成 | `tick`(完成) = true, `start_timer` = false; **stop_timer 不碰** |

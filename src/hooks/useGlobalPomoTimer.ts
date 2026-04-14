import { useEffect, useRef, useCallback } from 'react';
import { usePomoStore } from '@/store/pomoStore';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { 
  requestPermission, 
  isPermissionGranted,
} from '@tauri-apps/plugin-notification';

// 后端计时器数据类型
interface BackendTimerData {
  state: 'idle' | 'running' | 'paused';
  mode: 'focus' | 'shortBreak' | 'longBreak';
  timeLeft: number;
  totalTime: number;
  sessionId: number | null;
}

// 计时完成事件数据
interface PomoCompletedEvent {
  mode: 'focus' | 'shortBreak' | 'longBreak';
  sessionId: number | null;
}

/**
 * 全局番茄钟计时器 Hook
 * 
 * 使用 Tauri 后端计时器，确保即使窗口关闭（隐藏到托盘）也能继续计时和发送通知
 */
export function useGlobalPomoTimer() {
  const {
    isRunning,
    isPaused,
    timeLeft,
    mode,
    stopTimer,
    settings,
    todayCount,
    setMode,
    startTimer: startTimerStore,
    currentSessionId,
  } = usePomoStore();

  // 使用 ref 存储最新的状态，避免在回调中形成闭包
  const stateRef = useRef({
    isRunning,
    isPaused,
    timeLeft,
    mode,
    settings,
    todayCount,
    currentSessionId,
  });

  // 用于防止重复处理完成事件
  const isCompletingRef = useRef(false);
  // 用于标记是否正在处理自动切换
  const isAutoSwitchingRef = useRef(false);

  // 更新 refs
  useEffect(() => {
    stateRef.current = { isRunning, isPaused, timeLeft, mode, settings, todayCount, currentSessionId };
  }, [isRunning, isPaused, timeLeft, mode, settings, todayCount, currentSessionId]);

  // 请求通知权限
  useEffect(() => {
    const setupNotification = async () => {
      try {
        const permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          await requestPermission();
        }
      } catch (err) {
        console.error('请求通知权限失败:', err);
      }
    };
    setupNotification();
  }, []);

  // 处理计时完成
  const handleTimerComplete = useCallback(async (completedMode: 'focus' | 'shortBreak' | 'longBreak') => {
    // 防止重复处理
    if (isCompletingRef.current) {
      console.log('计时完成处理中，跳过重复调用');
      return;
    }
    
    isCompletingRef.current = true;
    
    try {
      const { settings: currentSettings, todayCount: currentTodayCount } = stateRef.current;

      console.log('计时完成，处理中...', { completedMode, currentSettings });

      // 先确保后端计时器已经停止
      try {
        await invoke('stop_pomo_timer');
        console.log('后端计时器已停止');
      } catch (err) {
        console.error('停止后端计时器失败:', err);
      }

      // 停止前端计时器（更新数据库等）
      await stopTimer(true);
      console.log('前端计时器已停止');

      // 标记正在自动切换，防止同步 effect 干扰
      isAutoSwitchingRef.current = true;

      // 自动切换模式
      if (currentSettings.autoStartBreaks && completedMode === 'focus') {
        const nextMode = (currentTodayCount % currentSettings.longBreakInterval === 0)
          ? 'longBreak'
          : 'shortBreak';
        setMode(nextMode);
        
        if (currentSettings.autoStartPomos) {
          // 延迟启动新计时器，确保状态已经完全重置
          setTimeout(() => {
            startTimerStore().then(() => {
              isAutoSwitchingRef.current = false;
            });
          }, 1000);
        } else {
          isAutoSwitchingRef.current = false;
        }
      } else if (currentSettings.autoStartPomos && completedMode !== 'focus') {
        setMode('focus');
        
        // 延迟启动新计时器
        setTimeout(() => {
          startTimerStore().then(() => {
            isAutoSwitchingRef.current = false;
          });
        }, 1000);
      } else {
        isAutoSwitchingRef.current = false;
      }
    } catch (err) {
      console.error('处理计时完成失败:', err);
      isAutoSwitchingRef.current = false;
    } finally {
      // 延迟重置标志，确保所有异步操作完成
      setTimeout(() => {
        isCompletingRef.current = false;
      }, 2000);
    }
  }, [stopTimer, setMode, startTimerStore]);

  // 监听后端事件
  useEffect(() => {
    let unlistenTick: UnlistenFn | null = null;
    let unlistenCompleted: UnlistenFn | null = null;
    let unlistenStateChanged: UnlistenFn | null = null;

    const setupListeners = async () => {
      // 监听每秒 tick 事件
      unlistenTick = await listen<BackendTimerData>('pomo:tick', (event) => {
        const { timeLeft: backendTimeLeft } = event.payload;
        const { timeLeft: currentTimeLeft } = stateRef.current;
        
        // 只有时间不一致时才更新，避免不必要的渲染
        if (backendTimeLeft !== currentTimeLeft) {
          // 直接更新 store，不调用 tick() 避免重复减1
          usePomoStore.setState({ timeLeft: backendTimeLeft });
        }
      });

      // 监听计时完成事件
      unlistenCompleted = await listen<PomoCompletedEvent>('pomo:completed', (event) => {
        console.log('收到计时完成事件:', event.payload);
        const { mode: completedMode } = event.payload;
        handleTimerComplete(completedMode);
      });

      // 监听状态变化事件
      unlistenStateChanged = await listen<BackendTimerData>('pomo:state-changed', (event) => {
        const { state, timeLeft: backendTimeLeft } = event.payload;
        
        // 同步状态到前端 store
        usePomoStore.setState({
          isRunning: state === 'running',
          isPaused: state === 'paused',
          timeLeft: backendTimeLeft,
        });
      });
    };

    setupListeners();

    return () => {
      if (unlistenTick) unlistenTick();
      if (unlistenCompleted) unlistenCompleted();
      if (unlistenStateChanged) unlistenStateChanged();
    };
  }, [handleTimerComplete]);

  // 同步前端状态到后端（当用户在前端操作时）
  // 注意：不依赖 timeLeft，避免后台 tick 事件触发频繁同步
  useEffect(() => {
    // 如果正在自动切换模式，跳过同步
    if (isAutoSwitchingRef.current) {
      console.log('正在自动切换模式，跳过同步');
      return;
    }

    const syncToBackend = async () => {
      try {
        // 获取后端当前状态
        const backendState = await invoke<BackendTimerData>('get_pomo_timer_state');
        
        // 如果前端正在运行但后端没有，启动后端计时器
        if (isRunning && !isPaused && backendState.state !== 'running') {
          console.log('同步：启动后端计时器');
          await invoke('start_pomo_timer', {
            mode,
            duration: timeLeft,
            sessionId: currentSessionId,
          });
        }
        // 如果前端暂停但后端在运行，暂停后端
        else if (isPaused && backendState.state === 'running') {
          console.log('同步：暂停后端计时器');
          await invoke('pause_pomo_timer');
        }
        // 如果前端恢复但后端暂停，恢复后端
        else if (isRunning && !isPaused && backendState.state === 'paused') {
          console.log('同步：恢复后端计时器');
          await invoke('resume_pomo_timer');
        }
        // 如果前端停止但后端在运行，停止后端
        else if (!isRunning && backendState.state !== 'idle') {
          console.log('同步：停止后端计时器');
          await invoke('stop_pomo_timer');
        }
      } catch (err) {
        console.error('同步计时器状态失败:', err);
      }
    };

    syncToBackend();
  }, [isRunning, isPaused, mode, currentSessionId]);

  // 组件挂载时检查后端状态（用于页面刷新恢复）
  useEffect(() => {
    const checkBackendState = async () => {
      try {
        const backendState = await invoke<BackendTimerData>('get_pomo_timer_state');
        
        // 如果后端有正在运行的计时器，同步到前端
        if (backendState.state === 'running' || backendState.state === 'paused') {
          console.log('恢复后端计时器状态:', backendState);
          usePomoStore.setState({
            isRunning: true,
            isPaused: backendState.state === 'paused',
            timeLeft: backendState.timeLeft,
            mode: backendState.mode,
          });
        }
      } catch (err) {
        console.error('检查后端状态失败:', err);
      }
    };

    checkBackendState();
  }, []);

  // 监听应用恢复事件（移动端从后台恢复时）
  useEffect(() => {
    let unlistenAppResumed: UnlistenFn | null = null;

    const setupAppResumedListener = async () => {
      try {
        unlistenAppResumed = await listen('app:resumed', async () => {
          console.log('应用恢复，重新检查后端状态');
          
          // 标记正在自动切换，防止同步 effect 干扰
          isAutoSwitchingRef.current = true;
          
          try {
            const backendState = await invoke<BackendTimerData>('get_pomo_timer_state');
            
            // 根据后端实际状态更新前端
            if (backendState.state === 'running' || backendState.state === 'paused') {
              console.log('应用恢复 - 同步后端计时器状态:', backendState);
              usePomoStore.setState({
                isRunning: true,
                isPaused: backendState.state === 'paused',
                timeLeft: backendState.timeLeft,
                mode: backendState.mode,
              });
            } else if (backendState.state === 'idle') {
              // 后端计时器已停止，可能是时间到了或被取消了
              const { isRunning } = stateRef.current;
              if (isRunning) {
                console.log('应用恢复 - 后端计时器已停止，前端同步停止');
                // 通知前端停止计时器（更新数据库等）
                stopTimer(false);
              }
            }
          } catch (err) {
            console.error('应用恢复 - 检查后端状态失败:', err);
          } finally {
            isAutoSwitchingRef.current = false;
          }
        });
      } catch (err) {
        console.error('监听 app:resumed 事件失败:', err);
      }
    };

    setupAppResumedListener();

    return () => {
      if (unlistenAppResumed) {
        unlistenAppResumed();
      }
    };
  }, [stopTimer]);
}

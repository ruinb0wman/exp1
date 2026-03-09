import { useEffect, useRef, useCallback } from 'react';
import { usePomoStore } from '@/store/pomoStore';
import { 
  requestPermission, 
  sendNotification, 
  isPermissionGranted,
} from '@tauri-apps/plugin-notification';

/**
 * 全局番茄钟计时器 Hook
 * 
 * 这个 hook 需要在应用顶层（App.tsx）使用，确保即使用户切换到其他页面，
 * 计时器也能继续运行。
 */
export function useGlobalPomoTimer() {
  const {
    isRunning,
    isPaused,
    timeLeft,
    mode,
    tick,
    stopTimer,
    settings,
    todayCount,
    setMode,
    startTimer,
  } = usePomoStore();

  // 使用 ref 存储最新的状态，避免在 interval 回调中形成闭包
  const stateRef = useRef({
    isRunning,
    isPaused,
    timeLeft,
    mode,
    settings,
    todayCount,
  });

  // 更新 refs
  useEffect(() => {
    stateRef.current = { isRunning, isPaused, timeLeft, mode, settings, todayCount };
  }, [isRunning, isPaused, timeLeft, mode, settings, todayCount]);

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

  // 发送系统通知（不自动显示窗口）
  const sendPomoNotification = useCallback(async (title: string, body: string) => {
    try {
      sendNotification({ title, body });
    } catch (err) {
      console.error('发送通知失败:', err);
    }
  }, []);

  // 处理计时完成
  const handleTimerComplete = useCallback(async () => {
    const { mode: currentMode, settings: currentSettings, todayCount: currentTodayCount } = stateRef.current;

    // 先停止当前计时
    await stopTimer(true);

    // 发送通知（不自动显示窗口）
    if (currentMode === 'focus') {
      await sendPomoNotification(
        '🍅 专注完成！',
        `恭喜完成一个番茄钟，休息一下吧~`
      );
    } else {
      await sendPomoNotification(
        '☕ 休息结束',
        `休息结束，准备开始新的专注吧！`
      );
    }

    // 自动切换模式
    if (currentSettings.autoStartBreaks && currentMode === 'focus') {
      const nextMode = (currentTodayCount % currentSettings.longBreakInterval === 0)
        ? 'longBreak'
        : 'shortBreak';
      setMode(nextMode);
      if (currentSettings.autoStartPomos) {
        setTimeout(() => startTimer(), 500);
      }
    } else if (currentSettings.autoStartPomos && currentMode !== 'focus') {
      setMode('focus');
      setTimeout(() => startTimer(), 500);
    }
  }, [stopTimer, setMode, startTimer, sendPomoNotification]);

  // 核心计时逻辑
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (isRunning && !isPaused) {
      intervalId = setInterval(() => {
        const { timeLeft: currentTimeLeft, isRunning: currentIsRunning, isPaused: currentIsPaused } = stateRef.current;
        
        if (!currentIsRunning || currentIsPaused) return;

        const newTimeLeft = currentTimeLeft - 1;

        if (newTimeLeft < 0) {
          // 时间到，完成计时
          handleTimerComplete();
        } else {
          tick();
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, isPaused, tick, handleTimerComplete]);

  // 页面可见性变化处理（用于补偿后台运行时的计时）
  useEffect(() => {
    let hiddenAt: number | null = null;

    const handleVisibilityChange = () => {
      const { isRunning: currentIsRunning, isPaused: currentIsPaused, timeLeft: currentTimeLeft } = stateRef.current;
      
      if (document.hidden && currentIsRunning && !currentIsPaused) {
        // 页面隐藏时，记录时间
        hiddenAt = Date.now();
        // 存储到 sessionStorage 以防页面刷新
        sessionStorage.setItem('pomoHiddenAt', hiddenAt.toString());
      } else if (!document.hidden && currentIsRunning && !currentIsPaused) {
        // 页面显示时，计算时间差
        const storedHiddenAt = sessionStorage.getItem('pomoHiddenAt');
        if (storedHiddenAt || hiddenAt) {
          const hideTime = storedHiddenAt ? parseInt(storedHiddenAt) : hiddenAt!;
          const diff = Math.floor((Date.now() - hideTime) / 1000);
          
          // 如果有时间差，补偿计时
          if (diff > 0) {
            const newTimeLeft = Math.max(0, currentTimeLeft - diff);
            
            // 更新 store 中的 timeLeft
            usePomoStore.setState({ timeLeft: newTimeLeft });
            
            // 如果已经超时，触发完成
            if (newTimeLeft === 0) {
              handleTimerComplete();
            }
          }
          
          sessionStorage.removeItem('pomoHiddenAt');
          hiddenAt = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleTimerComplete]);

  // 组件挂载时检查是否有未完成的计时（页面刷新恢复）
  useEffect(() => {
    const checkResumeTimer = () => {
      const hiddenAtStr = sessionStorage.getItem('pomoHiddenAt');
      const { isRunning: currentIsRunning, isPaused: currentIsPaused, timeLeft: currentTimeLeft } = stateRef.current;
      
      if (hiddenAtStr && currentIsRunning && !currentIsPaused) {
        const diff = Math.floor((Date.now() - parseInt(hiddenAtStr)) / 1000);
        if (diff > 0) {
          const newTimeLeft = Math.max(0, currentTimeLeft - diff);
          
          // 更新 store
          usePomoStore.setState({ timeLeft: newTimeLeft });
          
          if (newTimeLeft === 0) {
            handleTimerComplete();
          }
        }
        sessionStorage.removeItem('pomoHiddenAt');
      }
    };

    checkResumeTimer();
  }, [handleTimerComplete]);
}

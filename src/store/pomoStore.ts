import { create } from 'zustand';
import type { PomoMode, PomoSettings } from '@/db/types/pomo';
import { DEFAULT_POMO_SETTINGS } from '@/db/types/pomo';
import { 
  createPomoSession, 
  completePomoSession, 
  abortPomoSession,
  incrementInterruptions,
  getTodayCompletedPomoCount,
  getPomoSettings,
  savePomoSettings,
} from '@/db/services/pomoService';
import { useUserStore } from './userStore';

interface PomoState {
  // 当前状态
  mode: PomoMode;
  timeLeft: number; // 剩余秒数
  totalTime: number; // 当前模式总秒数
  isRunning: boolean;
  isPaused: boolean;
  selectedTaskId: number | null;
  todayCount: number;
  currentSessionId: number | null;
  settings: PomoSettings;
  
  // 动作
  setMode: (mode: PomoMode) => void;
  setSelectedTask: (taskId: number | null) => void;
  updateSettings: (settings: Partial<PomoSettings>) => void;
  startTimer: () => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (completed: boolean) => Promise<void>;
  tick: () => void;
  loadTodayCount: (userId: number) => Promise<void>;
  resetTimer: () => void;
}

// 音频上下文（用于提示音）
let audioContext: AudioContext | null = null;

// 播放提示音
function playNotificationSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

// 根据模式获取时长(秒)
function getDurationForMode(mode: PomoMode, settings: PomoSettings): number {
  switch (mode) {
    case 'focus':
      return settings.focusDuration * 60;
    case 'shortBreak':
      return settings.shortBreakDuration * 60;
    case 'longBreak':
      return settings.longBreakDuration * 60;
  }
}

export const usePomoStore = create<PomoState>((set, get) => ({
  // 初始状态
  mode: 'focus',
  timeLeft: DEFAULT_POMO_SETTINGS.focusDuration * 60,
  totalTime: DEFAULT_POMO_SETTINGS.focusDuration * 60,
  isRunning: false,
  isPaused: false,
  selectedTaskId: null,
  todayCount: 0,
  currentSessionId: null,
  settings: getPomoSettings(),

  // 切换模式
  setMode: (mode: PomoMode) => {
    const { settings, isRunning } = get();
    if (isRunning) return; // 运行中不允许切换
    
    const duration = getDurationForMode(mode, settings);
    set({
      mode,
      timeLeft: duration,
      totalTime: duration,
      isPaused: false,
    });
  },

  // 选择任务
  setSelectedTask: (taskId: number | null) => {
    set({ selectedTaskId: taskId });
  },

  // 更新设置
  updateSettings: (newSettings: Partial<PomoSettings>) => {
    const { settings, mode, isRunning } = get();
    const updated = { ...settings, ...newSettings };
    savePomoSettings(updated);
    set({ settings: updated });
    
    // 如果不在运行中，更新当前倒计时
    if (!isRunning) {
      const duration = getDurationForMode(mode, updated);
      set({
        timeLeft: duration,
        totalTime: duration,
      });
    }
  },

  // 开始计时
  startTimer: async () => {
    const { mode, totalTime, selectedTaskId, settings } = get();
    const userStore = useUserStore.getState();
    const userId = userStore.user?.id;
    
    if (!userId) return;

    // 创建数据库记录
    const sessionId = await createPomoSession({
      userId,
      taskId: selectedTaskId || undefined,
      mode,
      duration: totalTime,
      actualDuration: 0,
      status: 'running',
      interruptions: 0,
    });

    set({
      isRunning: true,
      isPaused: false,
      currentSessionId: sessionId,
    });

    // 播放开始音效
    if (settings.soundEnabled) {
      playNotificationSound();
    }
  },

  // 暂停计时
  pauseTimer: () => {
    const { currentSessionId } = get();
    if (currentSessionId) {
      incrementInterruptions(currentSessionId);
    }
    set({ isPaused: true });
  },

  // 恢复计时
  resumeTimer: () => {
    set({ isPaused: false });
  },

  // 停止计时
  stopTimer: async (completed: boolean) => {
    const { currentSessionId, totalTime, timeLeft, mode, settings } = get();
    const userStore = useUserStore.getState();
    
    if (!currentSessionId) return;

    const actualDuration = totalTime - timeLeft;
    
    if (completed) {
      await completePomoSession(currentSessionId, actualDuration);
      
      // 专注完成奖励积分
      if (mode === 'focus') {
        const userId = userStore.user?.id;
        if (userId) {
          await userStore.addPoints(
            5, // 每个番茄5积分
            'task_reward',
            currentSessionId
          );
        }
        
        // 刷新今日计数
        if (userId) {
          const count = await getTodayCompletedPomoCount(userId);
          set({ todayCount: count });
        }
      }
      
      // 播放完成音效
      if (settings.soundEnabled) {
        playNotificationSound();
      }
    } else {
      await abortPomoSession(currentSessionId, actualDuration);
    }

    set({
      isRunning: false,
      isPaused: false,
      currentSessionId: null,
    });
  },

  // 每秒滴答
  tick: () => {
    const { timeLeft, isRunning, isPaused, totalTime, mode, settings } = get();
    
    if (!isRunning || isPaused) return;

    const newTimeLeft = timeLeft - 1;
    
    if (newTimeLeft <= 0) {
      // 时间到，自动完成
      get().stopTimer(true);
      
      // 自动切换模式
      if (settings.autoStartBreaks && mode === 'focus') {
        const { todayCount } = get();
        const nextMode = (todayCount % settings.longBreakInterval === 0) 
          ? 'longBreak' 
          : 'shortBreak';
        get().setMode(nextMode);
        if (settings.autoStartPomos) {
          get().startTimer();
        }
      } else if (settings.autoStartPomos && mode !== 'focus') {
        get().setMode('focus');
        get().startTimer();
      } else {
        // 重置计时器显示
        set({ timeLeft: totalTime });
      }
    } else {
      set({ timeLeft: newTimeLeft });
    }
  },

  // 加载今日完成数
  loadTodayCount: async (userId: number) => {
    const count = await getTodayCompletedPomoCount(userId);
    set({ todayCount: count });
  },

  // 重置计时器
  resetTimer: () => {
    const { settings, mode, isRunning } = get();
    if (isRunning) return;
    
    const duration = getDurationForMode(mode, settings);
    set({
      timeLeft: duration,
      totalTime: duration,
      isPaused: false,
    });
  },
}));

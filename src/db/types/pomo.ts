export type PomoMode = 'focus' | 'shortBreak' | 'longBreak';
export type PomoStatus = 'running' | 'paused' | 'completed' | 'aborted';

// 番茄钟会话记录
export interface PomoSession {
  id?: number;
  userId: number;
  taskId?: number; // 关联的任务实例ID
  mode: PomoMode;
  duration: number; // 设定时长(秒)
  actualDuration: number; // 实际专注时长(秒)
  status: PomoStatus;
  startedAt: string; // 开始时间
  endedAt?: string; // 结束时间
  interruptions: number; // 中断次数
}

// 用户番茄钟设置
export interface PomoSettings {
  focusDuration: number; // 专注时长(分钟) 默认25
  shortBreakDuration: number; // 短休息时长(分钟) 默认5
  longBreakDuration: number; // 长休息时长(分钟) 默认15
  longBreakInterval: number; // 几个番茄后长休息 默认4
  autoStartBreaks: boolean; // 休息结束后自动开始下一个
  autoStartPomos: boolean; // 专注结束后自动开始休息
  soundEnabled: boolean; // 音效开关
}

// 默认设置
export const DEFAULT_POMO_SETTINGS: PomoSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomos: false,
  soundEnabled: true,
};

// 每种模式的显示配置
export const POMO_MODE_CONFIG: Record<PomoMode, {
  label: string;
  color: string;
  gradient: string;
}> = {
  focus: {
    label: '专注',
    color: '#f56565',
    gradient: 'from-primary to-primary-light',
  },
  shortBreak: {
    label: '短休',
    color: '#48bb78',
    gradient: 'from-green-400 to-green-500',
  },
  longBreak: {
    label: '长休',
    color: '#4299e1',
    gradient: 'from-blue-400 to-blue-500',
  },
};

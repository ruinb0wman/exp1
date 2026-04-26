import type { PomoSettings } from "./pomo";

export type SupportedLanguage = "zh" | "en";

export type PointsHistoryType = 
  | 'task_undo'       // 任务撤销
  | 'task_stage'      // 任务阶段完成
  | 'task_reward'     // 任务完成奖励（旧类型，兼容历史数据）
  | 'task_completion' // 任务完成奖励（新类型）
  | 'task_deduction'  // 任务进度回退扣除
  | 'reward_exchange' // 奖励兑换
  | 'admin_adjustment'; // 管理员调整

export interface User {
  id: number;
  createdAt: string;
  updatedAt?: string;
  name: string;
  totalPoints: number; // 总积分
  dayEndTime?: string; // 一天结束时间，"HH:mm" 格式，默认 "00:00"
  pomoSettings?: PomoSettings; // 番茄钟设置
  language?: SupportedLanguage; // 语言偏好
  silentStart?: boolean; // 静默启动（自启时不打开窗口）
}

export interface PointsHistory {
  id: string;
  userId: number;
  amount: number;
  type: PointsHistoryType;
  relatedInstanceId?: string;
  stageId?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

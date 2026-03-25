import type { PomoSettings } from "./pomo";

export type PointsHistoryType = 'task_reward' | 'task_undo' | 'reward_exchange' | 'admin_adjustment';

export interface User {
  id: number;
  createdAt: string;
  updatedAt: string; // 更新时间戳（用于同步）
  name: string;
  dayEndTime?: string; // 一天结束时间，"HH:mm" 格式，默认 "00:00"
  pomoSettings?: PomoSettings; // 番茄钟设置
}

export interface PointsHistory {
  id?: number;
  userId: number;
  amount: number; // 积分数量完成任务时为正数, 撤销完成兑换奖励时为负数
  type: PointsHistoryType;
  relatedInstanceId?: number; // task_instance id, reward_instance id
  createdAt: string; // 创建时间戳
  updatedAt: string; // 更新时间戳（用于同步，通常与 createdAt 相同）
}

export type PointsHistoryType = 'task_reward' | 'task_undo' | 'reward_exchange' | 'admin_adjustment';

export interface User {
  id: number;
  createdAt: string;
  name: string;
  dayEndTime?: string; // 一天结束时间，"HH:mm" 格式，默认 "00:00"
}

export interface PointsHistory {
  id?: number;
  userId: number;
  amount: number; // 积分数量完成任务时为正数, 撤销完成兑换奖励时为负数
  type: PointsHistoryType;
  relatedEntityId?: number; // task_instance id, reward_instance id
  createdAt: string; // 创建时间戳
}

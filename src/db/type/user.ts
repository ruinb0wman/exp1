export type PointsHistoryType = 'task_reward' | 'reward_exchange' | 'admin_adjustment';

export interface User {
  id: number;
  currentPoints: number;
  createdAt: string;
  name: string;
}

export interface PointsHistory {
  id?: number;
  userId: number;
  amount: number; // 积分数量完成任务时为正数, 撤销完成兑换奖励时为负数
  type: PointsHistoryType;
  relatedEntityId?: number; // task_instance id, reward_instance id
  createdAt: string; // 创建时间戳
}

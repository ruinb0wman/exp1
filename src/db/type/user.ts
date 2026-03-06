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
  amount: number;
  type: PointsHistoryType;
  relatedEntityId?: number;
  createdAt: string;
}

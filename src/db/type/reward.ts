export type RewardStatus = 'available' | 'used' | 'expired';
export type ReplenishmentMode = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RewardTemplate {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  pointsCost: number;
  validDuration: number;
  enabled: boolean;
  replenishmentMode: ReplenishmentMode;
  repeatInterval?: number;
  repeatDaysOfWeek?: number[];
  repeatDaysOfMonth?: number[];
  replenishmentNum?: number;
  replenishmentLimit?: number;
  createdAt?: string;
}

export interface RewardInstance {
  id?: number;
  templateId: number;
  userId: number;
  status: RewardStatus;
  exchangeAt: string;
  expiresAt?: string;
  usedAt?: string;
  createdAt?: string;
}

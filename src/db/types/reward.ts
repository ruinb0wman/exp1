export type RewardStatus = 'available' | 'used' | 'expired';
export type ReplenishmentMode = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RewardTemplate {
  id?: number;
  userId: number;
  title: string; // 奖品标题
  description?: string; //奖品描述
  pointsCost: number; // 奖品消耗的积分
  validDuration: number; // 奖品保质期, 过期后奖励实例不可用, 如果没有validDuration则不会过期
  enabled: boolean; // 模板是否启用
  replenishmentMode: ReplenishmentMode; // 补货模式
  repeatInterval?: number; // 补货周期,repeatMode为daily时. 表示每n天, repeatMode为weekly时表示每n周. repeatMode为monthly是为每n月
  repeatDaysOfWeek?: number[]; // 周, 0-6, 例如[1,5]表示周1和周5补货
  repeatDaysOfMonth?: number[]; // 月, 1-31, 例如[6,10]表示6号和10号补货
  replenishmentNum?: number; // 每次补货的数量
  replenishmentLimit?: number; // 最大库存限制, 补货不能超过最大库存
  createdAt?: string; // 模板创建时间
  updatedAt?: string; // 模板更新时间
}

export interface RewardInstance {
  id?: number;
  templateId: number;
  userId: number;
  status: RewardStatus;
  createdAt: string; // 创建(兑换)时间戳
  expiresAt?: string; // 过期时间戳=createdAt+validDuration, 如果没有validDuration则不会过期
  usedAt?: string; // 使用时间戳
}

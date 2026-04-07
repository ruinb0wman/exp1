export type RewardStatus = 'available' | 'used' | 'expired';
export type ReplenishmentMode = 'none' | 'daily' | 'weekly' | 'monthly';

// 预设图标名称列表
export const REWARD_ICONS = [
  'Gift',
  'Coffee',
  'Beer',
  'Cigarette',
  'Gamepad2',
  'ShoppingBag',
  'BookOpen',
  'Dumbbell',
  'Pizza',
  'IceCream',
  'Cookie',
  'CakeSlice',
  'Film',
  'Music',
  'Ticket',
  'Tv',
  'ShoppingCart',
  'Package',
  'Bike',
  'Plane',
  'Mountain',
  'GraduationCap',
  'Lightbulb',
  'Heart',
  'Star',
  'Zap',
  'Trophy',
  'Crown',
] as const;

export type RewardIconName = (typeof REWARD_ICONS)[number];

// 预设颜色列表
export const REWARD_ICON_COLORS = [
  '#f56565', // 红色 (primary)
  '#fc8181', // 浅红
  '#ed8936', // 橙色
  '#ecc94b', // 黄色
  '#48bb78', // 绿色
  '#38b2ac', // 青色
  '#4299e1', // 蓝色
  '#667eea', // 紫色
  '#ed64a6', // 粉色
  '#a0aec0', // 灰色
] as const;

export type RewardIconColor = (typeof REWARD_ICON_COLORS)[number];

export interface RewardTemplate {
  id: string;
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
  currentStock?: number;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  createdAt: string;
  updatedAt?: string;
}

export interface RewardInstance {
  id: string;
  templateId: string;
  template: RewardTemplate;
  userId: number;
  status: RewardStatus;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  usedAt?: string;
}

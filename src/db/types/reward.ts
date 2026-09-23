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
  /** 单个商品所需积分；0 = 不花积分（如每日免费额度） */
  pointsCost: number;
  /**
   * 单件折合金额（元，2 位小数）；0 = 不记金额
   * 消费记录金额 = moneyCost × 数量，与积分价互不换算
   */
  moneyCost: number;
  /**
   * 是否折合金额并计入消费统计；缺省（旧数据）视为 true
   */
  countInConsumption?: boolean;
  enabled: boolean;
  replenishmentMode: ReplenishmentMode;
  repeatInterval?: number;
  repeatDaysOfWeek?: number[];
  repeatDaysOfMonth?: number[];
  replenishmentNum?: number;
  replenishmentLimit?: number;
  currentStock?: number;
  lastReplenishedDate?: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  createdAt: string;
  updatedAt?: string;
}

/** 购买时的商品快照：商品改名或删除后统计仍可读 */
export interface RewardPurchaseSnapshot {
  templateId: string;
  title: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  pointsCost: number;
  /** 购买时的单件金额快照（元） */
  moneyCost: number;
  /** 购买那一刻的「计入消费统计」设置，统计与明细标注都按它判定 */
  countInConsumption?: boolean;
}

/** 消费记录：购买即消费，没有中间态 */
export interface RewardPurchase {
  id: string;
  userId: number;
  templateId: string;
  /** 购买时的商品快照 */
  template: RewardPurchaseSnapshot;
  quantity: number;
  /** 单价快照（等于 template.pointsCost），便于统计 */
  pointsCost: number;
  /** 实际扣除积分 = pointsCost * quantity */
  pointsSpent: number;
  /**
   * 折合金额 = moneyCost × quantity，保留 2 位小数
   * 关闭统计的购买不写该字段（undefined = 不计入消费统计），避免 0 被误读成真实金额
   */
  moneyAmount?: number;
  /**
   * 兑换时填写的一次性备注（整单一条）；缺省 = 未填
   *
   * 只读展示：不提供事后编辑入口，填错请删除该消费记录后重兑。
   */
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReplenishmentRecord {
	id: string;
	templateId: string;
	userId: number;
	quantity: number;
	stockBefore: number;
	stockAfter: number;
	reason: "auto" | "manual";
	scheduledDate: string; // 应该补货的日期
	createdAt: string;     // 实际补货时间
}

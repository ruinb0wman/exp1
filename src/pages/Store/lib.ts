import type { RewardTemplate } from "@/db/types";

export interface StoreReward {
  template: RewardTemplate;
  availableCount: number;
}

/**
 * 根据搜索关键词过滤奖励
 */
export function filterRewardsBySearch(
  rewards: StoreReward[],
  searchQuery: string
): StoreReward[] {
  if (!searchQuery.trim()) return rewards;
  
  const query = searchQuery.toLowerCase();
  return rewards.filter(({ template }) =>
    template.title.toLowerCase().includes(query)
  );
}

/**
 * 计算最大可兑换数量
 */
export function getMaxQuantity(
  reward: StoreReward | null,
  currentPoints: number
): number {
  if (!reward) return 1;
  const { template, availableCount } = reward;
  const maxByPoints = Math.floor(currentPoints / template.pointsCost);
  const maxByStock = template.replenishmentMode === 'none' ? Infinity : availableCount;
  return Math.min(maxByPoints, maxByStock, 99); // 最大限制99个
}

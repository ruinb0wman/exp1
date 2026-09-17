import type { RewardTemplate } from "@/db/types";
import { roundMoney } from "@/libs/reward";

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
 * 计算最大可购买数量（受积分与消费额度限制）
 */
export function getMaxQuantity(
  reward: StoreReward | null,
  currentPoints: number
): number {
  if (!reward) return 1;
  const { template, availableCount } = reward;

  const maxByPoints = template.pointsCost > 0
    ? Math.floor(currentPoints / template.pointsCost)
    : Infinity;

  const maxByStock = template.replenishmentMode === 'none' ? Infinity : availableCount;

  return Math.max(1, Math.min(maxByPoints, maxByStock, 99));
}

/**
 * 计算某商品购买指定数量折合的金额（元）
 */
export function getPurchaseMoney(
  template: RewardTemplate,
  quantity: number
): number {
  return roundMoney(template.moneyCost * quantity);
}

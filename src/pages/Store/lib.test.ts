import { describe, expect, it } from 'vitest';
import type { RewardTemplate } from '@/db/types';
import { getMaxQuantity, type StoreReward } from './lib';

/** 构造商店奖励（默认 100 积分、不补货、无限额度） */
function reward(
  overrides: Partial<RewardTemplate> = {},
  availableCount = Infinity
): StoreReward {
  return {
    template: {
      id: 't1',
      userId: 1,
      title: '吃饭',
      pointsCost: 100,
      moneyCost: 100,
      enabled: true,
      replenishmentMode: 'none',
      icon: 'Pizza',
      createdAt: '2026-09-01T00:00:00.000Z',
      ...overrides,
    } as RewardTemplate,
    availableCount,
  };
}

describe('getMaxQuantity', () => {
  it('无奖励时返回 1', () => {
    expect(getMaxQuantity(null, 1000)).toBe(1);
  });

  it('受积分限制：向下取整', () => {
    expect(getMaxQuantity(reward({ pointsCost: 100 }), 250)).toBe(2);
  });

  it('受消费额度限制', () => {
    expect(getMaxQuantity(reward({ replenishmentMode: 'daily' }, 5), 100000)).toBe(5);
  });

  it('不再有 99 件的上限', () => {
    expect(getMaxQuantity(reward({ pointsCost: 1 }), 1_000_000)).toBe(1_000_000);
  });

  it('0 积分且不补货：数量无上限', () => {
    expect(getMaxQuantity(reward({ pointsCost: 0 }), 0)).toBe(Infinity);
  });

  it('0 积分但有额度：受额度限制', () => {
    expect(getMaxQuantity(reward({ pointsCost: 0, replenishmentMode: 'daily' }, 7), 0)).toBe(7);
  });

  it('积分不足时仍返回 1（由 canRedeem 拦截）', () => {
    expect(getMaxQuantity(reward({ pointsCost: 100 }), 0)).toBe(1);
  });
});

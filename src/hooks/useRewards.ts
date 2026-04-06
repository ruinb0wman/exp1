import { useState, useEffect, useCallback } from 'react';
import type { RewardTemplate, RewardInstance } from '@/db/types';
import {
  getAllRewardTemplates,
  getRewardTemplateById,
  createRewardTemplate,
  updateRewardTemplate,
  deleteRewardTemplate,
  toggleRewardTemplateEnabled,
  getStoreRewardTemplates,
  getAvailableRewardInstances,
  getUserBackpack,
  getRewardStatistics,
  useRewardInstance,
  useRewardInstances,
  checkAndUpdateExpiredRewards,
  replenishRewardTemplate,
  redeemRewardsWithStockCheck,
} from '@/db/services';

// ==================== RewardTemplate Hooks ====================

/**
 * 获取所有奖励模板
 */
export function useRewardTemplates(userId?: number) {
  const [templates, setTemplates] = useState<RewardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllRewardTemplates(userId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { templates, isLoading, error, refresh };
}

/**
 * 获取单个奖励模板
 */
export function useRewardTemplate(id: string | null) {
  const [template, setTemplate] = useState<RewardTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (id === null) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRewardTemplateById(id);
      setTemplate(data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reward');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { template, isLoading, error, refresh };
}

/**
 * 奖励模板操作
 */
export function useRewardTemplateActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (template: Omit<RewardTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const id = await createRewardTemplate(template);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, updates: Partial<Omit<RewardTemplate, 'id' | 'createdAt'>>) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateRewardTemplate(id, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteRewardTemplate(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleEnabled = useCallback(async (id: string, enabled?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      await toggleRewardTemplateEnabled(id, enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { create, update, remove, toggleEnabled, isLoading, error };
}

// ==================== Store Hooks ====================

interface StoreReward {
  template: RewardTemplate;
  availableCount: number;
}

/**
 * 获取商店奖励列表（带库存）
 */
export function useStoreRewards(userId: number) {
  const [rewards, setRewards] = useState<StoreReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStoreRewardTemplates(userId);
      setRewards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load store');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { rewards, isLoading, error, refresh };
}

// ==================== Backpack Hooks ====================

interface RewardWithTemplate {
  instance: RewardInstance;
  template: RewardTemplate;
}

/**
 * 获取可用奖励实例
 */
export function useAvailableRewards(userId: number) {
  const [rewards, setRewards] = useState<RewardWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAvailableRewardInstances(userId);
      setRewards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { rewards, isLoading, error, refresh };
}

/**
 * 获取用户背包（所有奖励）
 */
export function useUserBackpack(userId: number) {
  const [items, setItems] = useState<RewardWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserBackpack(userId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backpack');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { items, isLoading, error, refresh };
}

/**
 * 奖励实例操作
 */
export function useRewardInstanceActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 兑换奖励（带库存检查）
   * 会自动检查库存、扣除库存并创建奖励实例
   * @param templateId 奖励模板ID
   * @param userId 用户ID
   * @param _validDuration 保留参数以保持兼容性，实际从模板读取
   * @param quantity 兑换数量，默认为1
   * @returns 创建的奖励实例ID数组
   */
  const redeem = useCallback(async (
    templateId: string,
    userId: number,
    _validDuration: number, // 保留参数以保持兼容性，实际从模板读取
    quantity: number = 1
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const ids = await redeemRewardsWithStockCheck(templateId, userId, quantity);
      return ids;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [])

  const useReward = useCallback(async (instanceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await useRewardInstance(instanceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to use reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 批量使用奖励实例
   * @param instanceIds 实例ID数组
   * @param quantity 要使用数量，不传则使用全部
   * @returns 实际使用的数量
   */
  const useRewardsBatch = useCallback(async (instanceIds: string[], quantity?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const count = await useRewardInstances(instanceIds, quantity);
      return count;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to use rewards');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkExpired = useCallback(async (userId?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const count = await checkAndUpdateExpiredRewards(userId);
      return count;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check expired');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const replenish = useCallback(async (templateId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const count = await replenishRewardTemplate(templateId);
      return count;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replenish');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { redeem, useReward, useRewardsBatch, checkExpired, replenish, isLoading, error };
}

// ==================== Statistics Hooks ====================

/**
 * 获取奖励统计
 */
export function useRewardStatistics(userId: number) {
  const [stats, setStats] = useState<{
    total: number;
    available: number;
    used: number;
    expired: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRewardStatistics(userId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { stats, isLoading, error, refresh };
}

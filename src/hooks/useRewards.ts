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
  createRewardInstance,
  useRewardInstance,
  checkAndUpdateExpiredRewards,
  replenishRewardTemplate,
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
export function useRewardTemplate(id: number | null) {
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

  const update = useCallback(async (id: number, updates: Partial<Omit<RewardTemplate, 'id' | 'createdAt'>>) => {
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

  const remove = useCallback(async (id: number) => {
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

  const toggleEnabled = useCallback(async (id: number, enabled?: boolean) => {
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

  const redeem = useCallback(async (
    templateId: number,
    userId: number,
    validDuration: number
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const expiresAt = validDuration > 0
        ? new Date(Date.now() + validDuration * 1000).toISOString()
        : undefined;

      const id = await createRewardInstance({
        templateId,
        userId,
        status: 'available',
        expiresAt,
      });
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem reward');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const useReward = useCallback(async (instanceId: number) => {
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

  const replenish = useCallback(async (templateId: number) => {
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

  return { redeem, useReward, checkExpired, replenish, isLoading, error };
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

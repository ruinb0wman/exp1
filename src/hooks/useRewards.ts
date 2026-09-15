import { useState, useEffect, useCallback, useRef } from 'react';
import type { RewardTemplate, ReplenishmentRecord } from '@/db/types';
import {
  getAllRewardTemplates,
  getRewardTemplateById,
  createRewardTemplate,
  updateRewardTemplate,
  deleteRewardTemplate,
  toggleRewardTemplateEnabled,
  getStoreRewardTemplates,
  getReplenishmentRecordsByTemplateId,
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
 * 获取商店奖励列表（带剩余消费额度）
 */
export function useStoreRewards(userId: number) {
  const [rewards, setRewards] = useState<StoreReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    setIsLoading(true);
    setError(null);
    try {
      const data = await getStoreRewardTemplates(userId);
      if (requestId.current !== currentRequest) return;
      setRewards(data);
    } catch (err) {
      if (requestId.current !== currentRequest) return;
      setError(err instanceof Error ? err.message : 'Failed to load store');
    } finally {
      if (requestId.current === currentRequest) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { rewards, isLoading, error, refresh };
}

// ==================== 消费额度补货 ====================

export function useReplenishmentHistory(templateId: string) {
  const [records, setRecords] = useState<ReplenishmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReplenishmentRecordsByTemplateId(templateId);
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load replenishment history');
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (templateId) {
      refresh();
    }
  }, [refresh, templateId]);

  return { records, isLoading, error, refresh };
}
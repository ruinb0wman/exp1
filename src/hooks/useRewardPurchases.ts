import { useCallback, useEffect, useRef, useState } from 'react';
import type { RewardPurchase } from '@/db/types';
import {
  getRewardPurchases,
  getRewardPurchaseStats,
  purchaseReward,
  deleteRewardPurchase,
  type RewardPurchaseStats,
} from '@/db/services';
import { resolvePeriod, getPeriodTimeWindow } from '@/libs/report/period';
import type { ReportPeriod } from '@/libs/report/types';
import { toUserDateString } from '@/libs/time';
import { useUserStore } from '@/store';

/** 消费统计的周期类型：记账只需要月/年/自定义 */
export type PurchaseScope = 'month' | 'year' | 'custom';

// ==================== 消费记录 ====================

/**
 * 获取用户全部消费记录（按时间倒序）
 */
export function useRewardPurchases(userId: number | null) {
  const [purchases, setPurchases] = useState<RewardPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPurchases([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRewardPurchases(userId);
      setPurchases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载消费记录失败');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { purchases, isLoading, error, refresh };
}

// ==================== 购买 / 删除回滚 ====================

/**
 * 购买即消费：扣积分 + 写消费记录（服务层单事务完成）
 * 删除记录会同时回滚积分与消费额度
 */
export function useRewardPurchaseActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async (templateId: string, userId: number, quantity: number = 1, note?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        return await purchaseReward(templateId, userId, quantity, note);
      } catch (err) {
        setError(err instanceof Error ? err.message : '购买失败');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const remove = useCallback(async (purchaseId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteRewardPurchase(purchaseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { purchase, remove, isLoading, error };
}

// ==================== 周期统计 ====================

interface UseRewardPurchaseStatsParams {
  userId: number | null;
  scope: PurchaseScope;
  /** 锚点用户日 YYYY-MM-DD */
  anchor: string;
  customStart?: string;
  customEnd?: string;
}

interface UseRewardPurchaseStatsReturn {
  stats: RewardPurchaseStats | null;
  period: ReportPeriod | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 按周期统计消费：复用 Reports 的周期解析，保证与积分明细/报告的时间口径一致
 */
export function useRewardPurchaseStats(
  params: UseRewardPurchaseStatsParams
): UseRewardPurchaseStatsReturn {
  const { userId, scope, anchor, customStart, customEnd } = params;
  const dayEndTime = useUserStore((state) => state.user?.dayEndTime) ?? '00:00';

  const [stats, setStats] = useState<RewardPurchaseStats | null>(null);
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setPeriod(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    setIsLoading(true);
    setError(null);
    try {
      const today = toUserDateString(new Date(), dayEndTime);
      const resolved = resolvePeriod({
        scope,
        anchor,
        customStart,
        customEnd,
        today,
      });
      const { startISO, endExclusiveISO } = getPeriodTimeWindow(resolved, dayEndTime);
      const result = await getRewardPurchaseStats(userId, startISO, endExclusiveISO);

      if (requestId.current !== currentRequest) return;
      setStats(result);
      setPeriod(resolved);
    } catch (loadError) {
      if (requestId.current !== currentRequest) return;
      setError(loadError instanceof Error ? loadError.message : '加载消费统计失败');
      setStats(null);
      setPeriod(null);
    } finally {
      if (requestId.current === currentRequest) {
        setIsLoading(false);
      }
    }
  }, [userId, scope, anchor, customStart, customEnd, dayEndTime]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, period, isLoading, error, refresh: load };
}

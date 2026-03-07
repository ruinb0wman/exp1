import { useState, useCallback, useEffect, useRef } from 'react';
import type { PointsHistory } from '@/db/types';
import {
  getPointsHistoryPaged,
  getPointsStats,
  type PointsHistoryFilterType,
  type PointsStats,
} from '@/db/services/pointsHistoryService';

const DEFAULT_PAGE_SIZE = 20;

// 获取默认时间范围（最近30天，UTC时间）
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  // 结束时间：现在（UTC）
  const endUTC = now.toISOString();
  // 开始时间：30天前的UTC开始
  const startUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 30,
    0, 0, 0, 0
  )).toISOString();

  return {
    startDate: startUTC,
    endDate: endUTC,
  };
}

interface UsePointsHistoryOptions {
  userId: number | null;
  pageSize?: number;
  autoLoad?: boolean;
}

interface UsePointsHistoryReturn {
  // 数据
  list: PointsHistory[];
  stats: PointsStats | null;
  hasMore: boolean;
  total: number;

  // 状态
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;

  // 筛选条件
  filterType: PointsHistoryFilterType;
  startDate: string;
  endDate: string;

  // 操作
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setFilterType: (type: PointsHistoryFilterType) => void;
  setDateRange: (start: string, end: string) => void;
  resetFilters: () => void;
}

export function usePointsHistory(options: UsePointsHistoryOptions): UsePointsHistoryReturn {
  const { userId, pageSize = DEFAULT_PAGE_SIZE, autoLoad = true } = options;

  const [list, setList] = useState<PointsHistory[]>([]);
  const [stats, setStats] = useState<PointsStats | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterTypeState] = useState<PointsHistoryFilterType>('all');
  const [startDate, setStartDate] = useState<string>(getDefaultDateRange().startDate);
  const [endDate, setEndDate] = useState<string>(getDefaultDateRange().endDate);

  // 使用 ref 来跟踪当前页码，避免闭包问题
  const pageRef = useRef(1);
  const isInitialLoadRef = useRef(true);

  // 加载第一页数据
  const loadFirstPage = useCallback(async () => {
    if (!userId) {
      setList([]);
      setHasMore(false);
      setTotal(0);
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [result, statsData] = await Promise.all([
        getPointsHistoryPaged(userId, {
          page: 1,
          pageSize,
          type: filterType,
          startDate,
          endDate,
        }),
        getPointsStats(userId, startDate, endDate),
      ]);

      setList(result.list);
      setHasMore(result.hasMore);
      setTotal(result.total);
      setStats(statsData);
      pageRef.current = 1;
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载积分历史失败');
    } finally {
      setIsLoading(false);
    }
  }, [userId, pageSize, filterType, startDate, endDate]);

  // 加载更多数据
  const loadMore = useCallback(async () => {
    if (!userId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const nextPage = pageRef.current + 1;
      const result = await getPointsHistoryPaged(userId, {
        page: nextPage,
        pageSize,
        type: filterType,
        startDate,
        endDate,
      });

      setList((prev) => [...prev, ...result.list]);
      setHasMore(result.hasMore);
      pageRef.current = nextPage;
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载更多数据失败');
    } finally {
      setIsLoadingMore(false);
    }
  }, [userId, pageSize, filterType, startDate, endDate, hasMore, isLoadingMore]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await loadFirstPage();
  }, [loadFirstPage]);

  // 设置筛选类型
  const setFilterType = useCallback(
    (type: PointsHistoryFilterType) => {
      setFilterTypeState(type);
      // 筛选条件改变时，自动重新加载
      // 注意：由于 state 更新是异步的，这里不需要手动调用 loadFirstPage
      // useEffect 会监听 filterType 的变化
    },
    []
  );

  // 设置时间范围
  const setDateRange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    // useEffect 会监听 startDate/endDate 的变化
  }, []);

  // 重置筛选条件
  const resetFilters = useCallback(() => {
    setFilterTypeState('all');
    const defaultRange = getDefaultDateRange();
    setStartDate(defaultRange.startDate);
    setEndDate(defaultRange.endDate);
  }, []);

  // 监听筛选条件变化，自动重新加载
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      loadFirstPage();
    }
  }, [filterType, startDate, endDate, loadFirstPage]);

  // 初始加载
  useEffect(() => {
    if (autoLoad && userId) {
      isInitialLoadRef.current = false;
      loadFirstPage();
    }
  }, [userId, autoLoad, loadFirstPage]);

  return {
    list,
    stats,
    hasMore,
    total,
    isLoading,
    isLoadingMore,
    error,
    filterType,
    startDate,
    endDate,
    loadMore,
    refresh,
    setFilterType,
    setDateRange,
    resetFilters,
  };
}

// 导出工具函数供外部使用
export { getDefaultDateRange };
export type { PointsHistoryFilterType, PointsStats };

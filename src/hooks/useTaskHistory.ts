import { useState, useEffect, useCallback, useRef } from "react";
import {
  getTaskInstancesWithFilter,
  type TaskHistoryItem,
  getTaskStatistics,
  type TaskHistoryFilterStatus,
} from "@/db/services";

export type { TaskHistoryFilterStatus };

const DEFAULT_PAGE_SIZE = 20;

interface UseTaskHistoryOptions {
  userId: number | null;
  pageSize?: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  skipped: number;
}

export function useTaskHistory({ userId, pageSize = DEFAULT_PAGE_SIZE }: UseTaskHistoryOptions) {
  const [list, setList] = useState<TaskHistoryItem[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskHistoryFilterStatus>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于防止重复加载的标记
  const loadingRef = useRef(false);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (userId === null) return;
    try {
      const data = await getTaskStatistics(userId);
      setStats(data);
    } catch (err) {
      console.error("Failed to load task stats:", err);
    }
  }, [userId]);

  // 加载列表数据
  const loadList = useCallback(async (isLoadMore = false) => {
    if (userId === null) return;
    if (loadingRef.current) return; // 防止重复加载

    loadingRef.current = true;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setOffset(0);
    }
    setError(null);

    try {
      const newOffset = isLoadMore ? offset : 0;
      const result = await getTaskInstancesWithFilter(
        userId,
        filterStatus,
        newOffset,
        pageSize
      );

      if (isLoadMore) {
        setList((prev) => [...prev, ...result.items]);
      } else {
        setList(result.items);
      }
      setHasMore(result.hasMore);
      setTotal(result.total);
      setOffset(newOffset + result.items.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [userId, filterStatus, offset, pageSize]);

  // 初始加载和筛选变化时刷新
  useEffect(() => {
    if (userId !== null) {
      loadList(false);
      loadStats();
    }
  }, [userId, filterStatus]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !loadingRef.current) {
      loadList(true);
    }
  }, [isLoadingMore, hasMore, loadList]);

  // 切换筛选状态
  const handleSetFilterStatus = useCallback((status: TaskHistoryFilterStatus) => {
    setFilterStatus(status);
    // 重置列表状态
    setList([]);
    setOffset(0);
    setHasMore(true);
  }, []);

  return {
    list,
    stats,
    hasMore,
    total,
    isLoading,
    isLoadingMore,
    error,
    filterStatus,
    loadMore,
    setFilterStatus: handleSetFilterStatus,
    refresh: () => loadList(false),
  };
}

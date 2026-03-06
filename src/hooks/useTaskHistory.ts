import { useState, useEffect, useCallback } from "react";
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

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  skipped: number;
}

export function useTaskHistory({ userId, pageSize = DEFAULT_PAGE_SIZE }: UseTaskHistoryOptions) {
  const [list, setList] = useState<TaskHistoryItem[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskHistoryFilterStatus>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化日期范围（最近30天）
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    setStartDate(start.toISOString());
    setEndDate(end.toISOString());
  }, []);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (userId === null) return;
    try {
      const data = await getTaskStatistics(userId, startDate || undefined, endDate || undefined);
      setStats(data);
    } catch (err) {
      console.error("Failed to load task stats:", err);
    }
  }, [userId, startDate, endDate]);

  // 加载列表数据
  const loadList = useCallback(async (isLoadMore = false) => {
    if (userId === null) return;
    if (!startDate || !endDate) return;

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
        startDate,
        endDate,
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
    }
  }, [userId, filterStatus, startDate, endDate, offset, pageSize]);

  // 初始加载和筛选变化时刷新
  useEffect(() => {
    if (userId !== null && startDate && endDate) {
      loadList(false);
      loadStats();
    }
  }, [userId, filterStatus, startDate, endDate]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadList(true);
    }
  }, [isLoadingMore, hasMore, loadList]);

  const setDateRange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
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
    startDate,
    endDate,
    loadMore,
    setFilterStatus,
    setDateRange,
    refresh: () => loadList(false),
  };
}

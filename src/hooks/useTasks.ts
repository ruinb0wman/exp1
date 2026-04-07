import { useState, useEffect, useCallback } from 'react';
import type { TaskTemplate, TaskInstance } from '@/db/types';
import { useTaskStore } from '@/store';
import {
  getAllTaskTemplates,
  getTaskTemplateById,
  createTaskTemplate,
  updateTaskTemplate,
  disableTaskTemplate,
  toggleTaskTemplateEnabled,
  getTaskInstancesByDate,
  completeTaskInstance,
  skipTaskInstance,
  resetTaskInstance,
  getTaskStatistics,
} from '@/db/services';

// ==================== TaskTemplate Hooks ====================

/**
 * 获取所有任务模板
 */
export function useTaskTemplates(userId?: number) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllTaskTemplates(userId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
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
 * 获取单个任务模板
 */
export function useTaskTemplate(id: string | null) {
  const [template, setTemplate] = useState<TaskTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (id === null) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTaskTemplateById(id);
      setTemplate(data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
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
 * 任务模板操作
 */
export function useTaskTemplateActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const id = await createTaskTemplate(template);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateTaskTemplate(id, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disable = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await disableTaskTemplate(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleEnabled = useCallback(async (id: string, enabled?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      await toggleTaskTemplateEnabled(id, enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { create, update, disable, toggleEnabled, isLoading, error };
}

// ==================== TaskInstance Hooks ====================

export interface TaskWithTemplate {
  instance: TaskInstance;
  template: TaskTemplate;
}

/**
 * 获取今日任务列表（支持 dayEndTime）- 使用全局 Store
 */
export function useTodayTasks(userId: number, dayEndTime?: string) {
  const { todayTasks, isLoading, error, subscribeToTodayTasks, refreshTodayTasks } = useTaskStore();

  useEffect(() => {
    if (userId) {
      subscribeToTodayTasks(userId, dayEndTime);
    }
  }, [userId, dayEndTime, subscribeToTodayTasks]);

  return { tasks: todayTasks, isLoading, error, refresh: refreshTodayTasks };
}

/**
 * 获取没有日期的任务列表 - 使用全局 Store
 */
export function useNoDateTasks(userId: number) {
  const { noDateTasks, isLoading, error, subscribeToNoDateTasks, refreshNoDateTasks } = useTaskStore();

  useEffect(() => {
    if (userId) {
      subscribeToNoDateTasks(userId);
    }
  }, [userId, subscribeToNoDateTasks]);

  return { tasks: noDateTasks, isLoading, error, refresh: refreshNoDateTasks };
}

/**
 * 获取指定日期的任务（支持 dayEndTime）
 */
export function useTasksByDate(date: string, userId?: number) {
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTaskInstancesByDate(date, userId);
      setInstances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [date, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { instances, isLoading, error, refresh };
}

/**
 * 任务实例操作
 */
export function useTaskInstanceActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async (instanceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await completeTaskInstance(instanceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const skip = useCallback(async (instanceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await skipTaskInstance(instanceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(async (instanceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await resetTaskInstance(instanceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { complete, skip, reset, isLoading, error };
}

// ==================== Statistics Hooks ====================

/**
 * 获取任务统计
 */
export function useTaskStatistics(
  userId: number,
  startDate?: string,
  endDate?: string
) {
  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    pending: number;
    skipped: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTaskStatistics(userId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, [userId, startDate, endDate]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { stats, isLoading, error, refresh };
}

import { useState, useEffect, useCallback } from 'react';
import type { TaskTemplate, TaskInstance } from '@/db/types';
import {
  getAllTaskTemplates,
  getTaskTemplateById,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  toggleTaskTemplateEnabled,
  getTodayTaskInstances,
  getNoDateTaskInstances,
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
export function useTaskTemplate(id: number | null) {
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

  const update = useCallback(async (id: number, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>) => {
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

  const remove = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteTaskTemplate(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleEnabled = useCallback(async (id: number, enabled?: boolean) => {
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

  return { create, update, remove, toggleEnabled, isLoading, error };
}

// ==================== TaskInstance Hooks ====================

export interface TaskWithTemplate {
  instance: TaskInstance;
  template: TaskTemplate;
}

/**
 * 获取今日任务列表（支持 dayEndTime）
 */
export function useTodayTasks(userId: number, dayEndTime?: string) {
  const [tasks, setTasks] = useState<TaskWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTodayTaskInstances(userId, dayEndTime);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today tasks');
    } finally {
      setIsLoading(false);
    }
  }, [userId, dayEndTime]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { tasks, isLoading, error, refresh };
}

/**
 * 获取没有日期的任务列表
 */
export function useNoDateTasks(userId: number) {
  const [tasks, setTasks] = useState<TaskWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getNoDateTaskInstances(userId);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load no date tasks');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [refresh, userId]);

  return { tasks, isLoading, error, refresh };
}

/**
 * 获取指定日期的任务（支持 dayEndTime）
 */
export function useTasksByDate(date: string, userId?: number, dayEndTime?: string) {
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTaskInstancesByDate(date, userId, dayEndTime);
      setInstances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [date, userId, dayEndTime]);

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

  const complete = useCallback(async (instanceId: number) => {
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

  const skip = useCallback(async (instanceId: number) => {
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

  const reset = useCallback(async (instanceId: number) => {
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

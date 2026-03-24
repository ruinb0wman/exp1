import { getDB } from '../index';
import type { TaskTemplate, TaskInstance, TaskStatus, RepeatMode } from '../types';

import { getUserStartOfDay, getUserEndOfDay, getUserCurrentDate, isExpired } from '@/libs/time';
import { updateUserPoints } from './userService';

// ==================== TaskTemplate CRUD ====================

/**
 * 创建任务模板
 */
export async function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const db = getDB();

  const now = new Date().toISOString();
  const newTemplate: TaskTemplate = {
    ...template,
    createdAt: now,
    updatedAt: now,
  };

  return db.taskTemplates.add(newTemplate);
}

/**
 * 获取所有任务模板
 */
export async function getAllTaskTemplates(userId?: number): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.taskTemplates.where('userId').equals(userId).toArray();
  }
  return db.taskTemplates.toArray();
}

/**
 * 获取启用的任务模板
 */
export async function getEnabledTaskTemplates(userId?: number): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    // 先按 userId 查询，再在内存中过滤 enabled
    const templates = await db.taskTemplates.where('userId').equals(userId).toArray();
    return templates.filter(t => t.enabled);
  }
  // 使用filter方法查询所有启用的模板
  return db.taskTemplates.filter(t => t.enabled).toArray();
}

/**
 * 根据ID获取任务模板
 */
export async function getTaskTemplateById(id: number): Promise<TaskTemplate | undefined> {
  const db = getDB();
  return db.taskTemplates.get(id);
}

/**
 * 根据重复模式获取任务模板
 */
export async function getTaskTemplatesByRepeatMode(
  repeatMode: RepeatMode,
  userId?: number
): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.taskTemplates.where('userId').equals(userId).toArray();
    return templates.filter(t => t.repeatMode === repeatMode);
  }
  return db.taskTemplates.where('repeatMode').equals(repeatMode).toArray();
}

/**
 * 更新任务模板
 */
export async function updateTaskTemplate(
  id: number,
  updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>
): Promise<number> {
  const db = getDB();

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return db.taskTemplates.update(id, updateData);
}

/**
 * 停用任务模板（模板不能删除，只能停用）
 */
export async function disableTaskTemplate(id: number): Promise<number> {
  const db = getDB();

  const template = await db.taskTemplates.get(id);
  if (!template) {
    throw new Error('Task template not found');
  }

  return db.taskTemplates.update(id, {
    enabled: false,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * 切换任务模板启用状态
 */
export async function toggleTaskTemplateEnabled(
  id: number,
  enabled?: boolean
): Promise<number> {
  const db = getDB();

  const template = await db.taskTemplates.get(id);
  if (!template) {
    throw new Error('Task template not found');
  }

  const newEnabled = enabled !== undefined ? enabled : !template.enabled;

  return db.taskTemplates.update(id, {
    enabled: newEnabled,
    updatedAt: new Date().toISOString(),
  });
}

// ==================== TaskInstance CRUD ====================

/**
 * 创建任务实例
 */
export async function createTaskInstance(
  instance: Omit<TaskInstance, 'id' | 'createdAt'>
): Promise<number> {
  const db = getDB();

  const newInstance: TaskInstance = {
    ...instance,
    createdAt: new Date().toISOString(),
  };

  return db.taskInstances.add(newInstance);
}

/**
 * 批量创建任务实例
 */
export async function createTaskInstances(
  instances: Omit<TaskInstance, 'id' | 'createdAt'>[]
): Promise<number[]> {
  const db = getDB();

  const now = new Date().toISOString();
  const newInstances: TaskInstance[] = instances.map((instance) => ({
    ...instance,
    createdAt: now,
  }));

  return db.taskInstances.bulkAdd(newInstances, { allKeys: true });
}

/**
 * 获取所有任务实例
 */
export async function getAllTaskInstances(userId?: number): Promise<TaskInstance[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.taskInstances.where('userId').equals(userId).toArray();
  }
  return db.taskInstances.toArray();
}

/**
 * 根据ID获取任务实例
 */
export async function getTaskInstanceById(id: number): Promise<TaskInstance | undefined> {
  const db = getDB();
  return db.taskInstances.get(id);
}

/**
 * 根据模板ID获取任务实例
 */
export async function getTaskInstancesByTemplateId(templateId: number): Promise<TaskInstance[]> {
  const db = getDB();
  return db.taskInstances.where('templateId').equals(templateId).toArray();
}

/**
 * 根据状态获取任务实例
 */
export async function getTaskInstancesByStatus(
  status: TaskStatus,
  userId?: number
): Promise<TaskInstance[]> {
  const db = getDB();

  if (userId !== undefined) {
    const instances = await db.taskInstances.where('userId').equals(userId).toArray();
    return instances.filter(i => i.status === status);
  }
  return db.taskInstances.where('status').equals(status).toArray();
}

/**
 * 获取指定日期范围内的任务实例
 */
export async function getTaskInstancesByDateRange(
  startDate: string,
  endDate: string,
  userId?: number
): Promise<TaskInstance[]> {
  const db = getDB();

  let collection = db.taskInstances
    .where('startAt')
    .between(startDate, endDate, true, true);

  if (userId !== undefined) {
    collection = collection.and((instance) => instance.userId === userId);
  }

  return collection.toArray();
}

/**
 * 获取指定日期的任务实例
 * @param date 本地日期字符串 YYYY-MM-DD
 */
export async function getTaskInstancesByDate(
  date: string,
  userId?: number,
  dayEndTime: string = "00:00"
): Promise<TaskInstance[]> {
  // 将 YYYY-MM-DD 解析为本地时间的日期
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  
  const startOfDay = getUserStartOfDay(localDate, dayEndTime);
  const endOfDay = getUserEndOfDay(localDate, dayEndTime);

  return getTaskInstancesByDateRange(startOfDay, endOfDay, userId);
}

/**
 * 更新任务实例
 */
export async function updateTaskInstance(
  id: number,
  updates: Partial<Omit<TaskInstance, 'id'>>
): Promise<number> {
  const db = getDB();
  return db.taskInstances.update(id, updates);
}

/**
 * 完成任务实例
 */
export async function completeTaskInstance(id: number): Promise<number> {
  const db = getDB();

  const instance = await db.taskInstances.get(id);
  if (!instance) {
    throw new Error('Task instance not found');
  }

  if (instance.status === 'completed') {
    throw new Error('Task instance already completed');
  }

  return db.taskInstances.update(id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
}

/**
 * 跳过任务实例
 */
export async function skipTaskInstance(id: number): Promise<number> {
  const db = getDB();

  const instance = await db.taskInstances.get(id);
  if (!instance) {
    throw new Error('Task instance not found');
  }

  if (instance.status === 'completed') {
    throw new Error('Cannot skip completed task instance');
  }

  return db.taskInstances.update(id, {
    status: 'skipped',
  });
}

/**
 * 重置任务实例状态为待处理
 */
export async function resetTaskInstance(id: number): Promise<number> {
  const db = getDB();

  return db.taskInstances.update(id, {
    status: 'pending',
    completedAt: undefined,
    completeProgress: 0,
  });
}

/**
 * 删除任务实例
 */
export async function deleteTaskInstance(id: number): Promise<void> {
  const db = getDB();
  return db.taskInstances.delete(id);
}

/**
 * 批量删除任务实例
 */
export async function deleteTaskInstances(ids: number[]): Promise<void> {
  const db = getDB();
  return db.taskInstances.bulkDelete(ids);
}

/**
 * 删除指定模板的所有任务实例
 */
export async function deleteTaskInstancesByTemplateId(templateId: number): Promise<number> {
  const db = getDB();
  return db.taskInstances.where('templateId').equals(templateId).delete();
}

// ==================== 复合查询 ====================

/**
 * 获取任务实例及其模板信息
 * 注意：现在 template 直接存储在 instance 中，此函数主要用于兼容旧代码
 */
export async function getTaskInstanceWithTemplate(
  instanceId: number
): Promise<{ instance: TaskInstance; template?: TaskTemplate } | undefined> {
  const db = getDB();

  const instance = await db.taskInstances.get(instanceId);
  if (!instance) {
    return undefined;
  }

  // 优先使用 instance 中存储的 template 快照
  return { instance, template: instance.template };
}



/**
 * 获取用户的今日任务（包含模板信息）（更新：支持 dayEndTime）
 * 注意：现在 template 直接存储在 instance 中
 */
export async function getTodayTaskInstances(
  userId: number,
  dayEndTime: string = "00:00"
): Promise<Array<{ instance: TaskInstance; template: TaskTemplate }>> {
  const db = getDB();

  // 使用 getUserCurrentDate 获取"用户眼中的今天"（考虑 dayEndTime 偏移）
  // 例如：当前 00:00，dayEndTime 为 02:00，则返回昨天的日期
  const todayStr = getUserCurrentDate(dayEndTime);
  const [year, month, day] = todayStr.split('-').map(Number);
  const today = new Date(year, month - 1, day);

  // 使用 dayEndTime 获取今天的开始和结束
  const startOfDay = getUserStartOfDay(today, dayEndTime);
  const endOfDay = getUserEndOfDay(today, dayEndTime);

  const instances = await db.taskInstances
    .where('startAt')
    .between(startOfDay, endOfDay, true, true)
    .and((instance) => instance.userId === userId)
    .toArray();

  // 直接从 instance 中获取 template，无需额外查询
  return instances
    .filter((instance) => instance.template) // 过滤掉没有 template 的实例
    .map((instance) => ({
      instance,
      template: instance.template,
    }));
}

/**
 * 获取用户没有日期的任务（包含模板信息）
 * No Date 任务定义为：repeatMode 为 'none' 的 template 对应的 instance
 * 注意：现在 template 直接存储在 instance 中
 */
export async function getNoDateTaskInstances(
  userId: number
): Promise<Array<{ instance: TaskInstance; template: TaskTemplate }>> {
  const db = getDB();

  // 获取所有没有 startAt 的任务实例
  const instances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .toArray();

  const noDateInstances = instances.filter((instance) => !instance.startAt);

  // 直接从 instance 中获取 template，无需额外查询
  return noDateInstances
    .filter((instance) => instance.template)
    .map((instance) => ({
      instance,
      template: instance.template,
    }));
}

/**
 * 获取任务统计信息（只统计有对应模板的实例）
 * 注意：现在 template 直接存储在 instance 中
 */
export async function getTaskStatistics(
  userId: number
): Promise<{
  total: number;
  completed: number;
  pending: number;
  skipped: number;
}> {
  const db = getDB();

  // 获取该用户的所有任务实例
  const instances = await db.taskInstances.where('userId').equals(userId).toArray();

  // 只保留有 template 字段的实例
  const validInstances = instances.filter(i => i.template);

  return {
    total: validInstances.length,
    completed: validInstances.filter((i) => i.status === 'completed').length,
    pending: validInstances.filter((i) => i.status === 'pending').length,
    skipped: validInstances.filter((i) => i.status === 'skipped').length,
  };
}

// ==================== 任务历史查询 ====================

export type TaskHistoryFilterStatus = 'all' | 'pending' | 'completed' | 'skipped';
export type { TaskInstance, TaskTemplate, TaskStatus } from '../types';

export interface TaskHistoryItem {
  instance: TaskInstance;
  template: TaskTemplate;
}

/**
 * 获取任务历史列表（支持状态筛选和分页）
 * 按照 createdAt 从新到旧排序，支持滚动加载
 * 注意：现在 template 直接存储在 instance 中
 */
export async function getTaskInstancesWithFilter(
  userId: number,
  filterStatus: TaskHistoryFilterStatus,
  offset: number,
  limit: number
): Promise<{ items: TaskHistoryItem[]; hasMore: boolean; total: number }> {
  const db = getDB();

  // 获取该用户的所有任务实例
  const allInstances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .toArray();

  // 应用状态筛选
  let instances = allInstances;
  if (filterStatus !== 'all') {
    instances = instances.filter((i) => i.status === filterStatus);
  }

  // 按创建时间倒序排列（从新到旧）
  instances.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 直接从 instance 中获取 template，过滤掉没有 template 的实例
  const validItems: TaskHistoryItem[] = [];
  for (const instance of instances) {
    if (instance.template) {
      validItems.push({ instance, template: instance.template });
    }
  }

  const total = validItems.length;

  // 分页
  const paginatedItems = validItems.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    hasMore: offset + limit < total,
    total,
  };
}

// ==================== 进度相关方法 ====================

/**
 * 更新任务进度（用于 time/count 类型任务）
 * @param instanceId 任务实例ID
 * @param progressDelta 进度变化量（正数增加，负数减少）
 * @returns 更新后的实例ID
 */
export async function updateTaskProgress(
  instanceId: number,
  progressDelta: number
): Promise<number> {
  const db = getDB();

  return db.transaction('rw', db.taskInstances, db.taskTemplates, db.pointsHistory, db.users, async () => {
    const instance = await db.taskInstances.get(instanceId);
    if (!instance) {
      throw new Error('Task instance not found');
    }

    // 检查是否过期
    if (isExpired(instance.expiredAt)) {
      throw new Error('Task instance has expired');
    }

    // 直接从 instance 中获取 template 快照
    const template = instance.template;
    if (!template?.completeRule) {
      throw new Error('Task does not support progress tracking');
    }

    const currentProgress = instance.completeProgress ?? 0;
    const newProgress = Math.max(0, currentProgress + progressDelta);
    const target = template.completeTarget ?? 0;

    // 判断是否完成或重置
    const shouldComplete = newProgress >= target && instance.status !== 'completed';
    const shouldReset = newProgress < target && instance.status === 'completed';

    const updates: Partial<TaskInstance> = {
      completeProgress: newProgress,
    };

    if (shouldComplete) {
      updates.status = 'completed';
      updates.completedAt = new Date().toISOString();

      // 任务完成时自动发放积分奖励
      if (template.rewardPoints && template.rewardPoints > 0) {
        await updateUserPoints(
          instance.userId,
          template.rewardPoints,
          'task_reward',
          instanceId
        );
      }
    } else if (shouldReset) {
      updates.status = 'pending';
      updates.completedAt = undefined;
    }

    await db.taskInstances.update(instanceId, updates);
    return instanceId;
  });
}

/**
 * 通过番茄钟完成自动更新进度（向下取整到分钟）
 * @param instanceId 任务实例ID
 * @param durationSeconds 专注时长（秒）
 * @returns 更新后的实例ID
 */
export async function addPomoToTaskProgress(
  instanceId: number,
  durationSeconds: number
): Promise<number> {
  // 向下取整到分钟，不足1分钟视为0
  const durationMinutes = Math.floor(durationSeconds / 60);
  if (durationMinutes <= 0) {
    return instanceId; // 不足1分钟，不更新
  }
  return updateTaskProgress(instanceId, durationMinutes);
}

/**
 * 检查任务实例是否过期
 * @param instance 任务实例
 */
export function isTaskInstanceExpired(instance: TaskInstance): boolean {
  return isExpired(instance.expiredAt);
}

/**
 * 获取任务的完成进度百分比
 * @param instance 任务实例
 * @param template 任务模板（可选，默认使用 instance.template）
 * @returns 0-100 的百分比
 */
export function getTaskProgressPercent(
  instance: TaskInstance,
  template?: TaskTemplate
): number {
  // 优先使用传入的 template，否则使用 instance 中存储的 template 快照
  const tmpl = template ?? instance.template;
  if (!tmpl?.completeRule || !tmpl.completeTarget) {
    return instance.status === 'completed' ? 100 : 0;
  }
  const progress = instance.completeProgress ?? 0;
  return Math.min(100, Math.round((progress / tmpl.completeTarget) * 100));
}

/**
 * 批量检查并更新过期的 pending 任务实例
 * 将已过期的任务状态更新为 'skipped'（跳过的过期任务）
 * @param userId 用户ID
 * @returns 更新的任务实例ID列表
 */
export async function checkAndUpdateExpiredTasks(userId: number): Promise<number[]> {
  const db = getDB();
  const now = new Date().toISOString();
  
  // 获取所有 pending 状态且有过期时间的任务实例
  const pendingInstances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .and(instance => instance.status === 'pending' && !!instance.expiredAt)
    .toArray();
  
  // 筛选出过期的任务
  const expiredInstances = pendingInstances.filter(instance => isExpired(instance.expiredAt));
  
  if (expiredInstances.length === 0) {
    return [];
  }
  
  // 批量更新过期任务状态为 'skipped'
  const updatePromises = expiredInstances.map(instance => 
    db.taskInstances.update(instance.id!, {
      status: 'skipped',
      completedAt: now,
    })
  );
  
  await Promise.all(updatePromises);
  
  return expiredInstances.map(instance => instance.id!);
}

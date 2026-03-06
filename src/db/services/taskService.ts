import { useDB } from '../index';
import type { TaskTemplate, TaskInstance, TaskStatus, RepeatMode } from '../types';

// ==================== TaskTemplate CRUD ====================

/**
 * 创建任务模板
 */
export async function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
  const db = getDB();

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return db.taskTemplates.update(id, updateData);
}

/**
 * 删除任务模板（同时删除关联的任务实例）
 */
export async function deleteTaskTemplate(id: number): Promise<void> {
  const { getDB } = useDB();
  const db = getDB();

  await db.transaction('rw', db.taskTemplates, db.taskInstances, async () => {
    await db.taskInstances.where('templateId').equals(id).delete();
    await db.taskTemplates.delete(id);
  });
}

/**
 * 切换任务模板启用状态
 */
export async function toggleTaskTemplateEnabled(
  id: number,
  enabled?: boolean
): Promise<number> {
  const { getDB } = useDB();
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
  instance: Omit<TaskInstance, 'id' | 'createAt'>
): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();

  const newInstance: TaskInstance = {
    ...instance,
    createAt: new Date().toISOString(),
  };

  return db.taskInstances.add(newInstance);
}

/**
 * 批量创建任务实例
 */
export async function createTaskInstances(
  instances: Omit<TaskInstance, 'id' | 'createAt'>[]
): Promise<number[]> {
  const { getDB } = useDB();
  const db = getDB();

  const now = new Date().toISOString();
  const newInstances: TaskInstance[] = instances.map((instance) => ({
    ...instance,
    createAt: now,
  }));

  return db.taskInstances.bulkAdd(newInstances, { allKeys: true });
}

/**
 * 获取所有任务实例
 */
export async function getAllTaskInstances(userId?: number): Promise<TaskInstance[]> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
  const db = getDB();
  return db.taskInstances.get(id);
}

/**
 * 根据模板ID获取任务实例
 */
export async function getTaskInstancesByTemplateId(templateId: number): Promise<TaskInstance[]> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
 */
export async function getTaskInstancesByDate(
  date: string,
  userId?: number
): Promise<TaskInstance[]> {
  const { getDB } = useDB();
  const db = getDB();

  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  return getTaskInstancesByDateRange(startOfDay, endOfDay, userId);
}

/**
 * 更新任务实例
 */
export async function updateTaskInstance(
  id: number,
  updates: Partial<Omit<TaskInstance, 'id'>>
): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();
  return db.taskInstances.update(id, updates);
}

/**
 * 完成任务实例
 */
export async function completeTaskInstance(id: number): Promise<number> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
  const db = getDB();

  return db.taskInstances.update(id, {
    status: 'pending',
    completedAt: undefined,
  });
}

/**
 * 删除任务实例
 */
export async function deleteTaskInstance(id: number): Promise<void> {
  const { getDB } = useDB();
  const db = getDB();
  return db.taskInstances.delete(id);
}

/**
 * 批量删除任务实例
 */
export async function deleteTaskInstances(ids: number[]): Promise<void> {
  const { getDB } = useDB();
  const db = getDB();
  return db.taskInstances.bulkDelete(ids);
}

/**
 * 删除指定模板的所有任务实例
 */
export async function deleteTaskInstancesByTemplateId(templateId: number): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();
  return db.taskInstances.where('templateId').equals(templateId).delete();
}

// ==================== 复合查询 ====================

/**
 * 获取任务实例及其模板信息
 */
export async function getTaskInstanceWithTemplate(
  instanceId: number
): Promise<{ instance: TaskInstance; template?: TaskTemplate } | undefined> {
  const { getDB } = useDB();
  const db = getDB();

  const instance = await db.taskInstances.get(instanceId);
  if (!instance) {
    return undefined;
  }

  const template = await db.taskTemplates.get(instance.templateId);
  return { instance, template };
}

/**
 * 获取用户的今日任务（包含模板信息）
 */
export async function getTodayTaskInstances(
  userId: number
): Promise<Array<{ instance: TaskInstance; template: TaskTemplate }>> {
  const { getDB } = useDB();
  const db = getDB();

  const today = new Date().toISOString().split('T')[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const instances = await db.taskInstances
    .where('startAt')
    .between(startOfDay, endOfDay, true, true)
    .and((instance) => instance.userId === userId)
    .toArray();

  const result: Array<{ instance: TaskInstance; template: TaskTemplate }> = [];

  for (const instance of instances) {
    const template = await db.taskTemplates.get(instance.templateId);
    if (template) {
      result.push({ instance, template });
    }
  }

  return result;
}

/**
 * 获取用户没有日期的任务（包含模板信息）
 * No Date 任务定义为：repeatMode 为 'none' 的 template 对应的 instance
 */
export async function getNoDateTaskInstances(
  userId: number
): Promise<Array<{ instance: TaskInstance; template: TaskTemplate }>> {
  const { getDB } = useDB();
  const db = getDB();

  // 获取所有 repeatMode 为 'none' 的任务模板
  const templates = await db.taskTemplates
    .where('userId')
    .equals(userId)
    .toArray();
  
  const noRepeatTemplates = templates.filter(t => t.repeatMode === 'none');
  const noRepeatTemplateIds = new Set(noRepeatTemplates.map(t => t.id));

  if (noRepeatTemplateIds.size === 0) {
    return [];
  }

  // 获取这些模板对应的任务实例
  const instances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .toArray();

  const noDateInstances = instances.filter((instance) => 
    noRepeatTemplateIds.has(instance.templateId)
  );

  const result: Array<{ instance: TaskInstance; template: TaskTemplate }> = [];

  for (const instance of noDateInstances) {
    const template = noRepeatTemplates.find(t => t.id === instance.templateId);
    if (template) {
      result.push({ instance, template });
    }
  }

  return result;
}

/**
 * 获取任务统计信息
 */
export async function getTaskStatistics(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  total: number;
  completed: number;
  pending: number;
  skipped: number;
}> {
  const { getDB } = useDB();
  const db = getDB();

  let instances: TaskInstance[];

  if (startDate && endDate) {
    instances = await db.taskInstances
      .where('startAt')
      .between(startDate, endDate, true, true)
      .and((instance) => instance.userId === userId)
      .toArray();
  } else {
    instances = await db.taskInstances.where('userId').equals(userId).toArray();
  }

  return {
    total: instances.length,
    completed: instances.filter((i) => i.status === 'completed').length,
    pending: instances.filter((i) => i.status === 'pending').length,
    skipped: instances.filter((i) => i.status === 'skipped').length,
  };
}

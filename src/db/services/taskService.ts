import { getDB } from '../index';
import type { 
  TaskTemplate, 
  TaskInstance, 
  TaskStatus, 
  RepeatMode, 
  Stage
} from '../types';
import type { PointsHistory } from '../types/user';

import { getUserStartOfDay, getUserEndOfDay, getUserCurrentDate, isExpired } from '@/libs/time';

// ==================== 类型定义 ====================

export interface ProgressUpdateResult {
  stagesCompleted: string[];      // 本次新完成的阶段ID
  stagesReverted: string[];       // 本次回退的阶段ID
  pointsEarned: number;           // 本次获得积分
  pointsDeducted: number;         // 本次扣除积分
  isFullyCompleted: boolean;      // 是否已全部完成
  currentProgress: number;        // 当前进度
}

export interface SubtaskUpdateResult {
  completedCount: number;         // 已完成子任务数
  pointsEarned: number;           // 本次获得积分
  pointsDeducted: number;         // 本次扣除积分
  isFullyCompleted: boolean;      // 是否已达完成条件
}

// ==================== TaskTemplate CRUD ====================

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

export async function getAllTaskTemplates(userId?: number): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.taskTemplates.where('userId').equals(userId).toArray();
  }
  return db.taskTemplates.toArray();
}

export async function getEnabledTaskTemplates(userId?: number): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.taskTemplates.where('userId').equals(userId).toArray();
    return templates.filter(t => t.enabled);
  }
  return db.taskTemplates.filter(t => t.enabled).toArray();
}

export async function getTaskTemplateById(id: number): Promise<TaskTemplate | undefined> {
  const db = getDB();
  return db.taskTemplates.get(id);
}

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

export async function getAllTaskInstances(userId?: number): Promise<TaskInstance[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.taskInstances.where('userId').equals(userId).toArray();
  }
  return db.taskInstances.toArray();
}

export async function getTaskInstanceById(id: number): Promise<TaskInstance | undefined> {
  const db = getDB();
  return db.taskInstances.get(id);
}

export async function getTaskInstancesByTemplateId(templateId: number): Promise<TaskInstance[]> {
  const db = getDB();
  return db.taskInstances.where('templateId').equals(templateId).toArray();
}

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

export async function getTaskInstancesByDate(
  date: string,
  userId?: number,
  dayEndTime: string = "00:00"
): Promise<TaskInstance[]> {
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  
  const startOfDay = getUserStartOfDay(localDate, dayEndTime);
  const endOfDay = getUserEndOfDay(localDate, dayEndTime);

  return getTaskInstancesByDateRange(startOfDay, endOfDay, userId);
}

export async function updateTaskInstance(
  id: number,
  updates: Partial<Omit<TaskInstance, 'id'>>
): Promise<number> {
  const db = getDB();
  return db.taskInstances.update(id, updates);
}

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

export async function resetTaskInstance(id: number): Promise<number> {
  const db = getDB();
  const instance = await db.taskInstances.get(id);
  if (!instance) {
    throw new Error('Task instance not found');
  }

  const template = instance.template;
  const rule = template.completeRule;

  // 重置所有进度相关字段
  const updates: Partial<TaskInstance> = {
    status: 'pending',
    completedAt: undefined,
    completeProgress: 0,
    completedStages: [],
    stagePointsEarned: 0,
    completionPointsEarned: 0,
    isFullyCompleted: false,
  };

  // 如果是 subtask 类型，重置子任务完成状态
  if (rule?.type === 'subtask') {
    updates.completedSubtasks = instance.subtasks.map(() => false);
  }

  return db.taskInstances.update(id, updates);
}

export async function deleteTaskInstance(id: number): Promise<void> {
  const db = getDB();
  return db.taskInstances.delete(id);
}

export async function deleteTaskInstances(ids: number[]): Promise<void> {
  const db = getDB();
  return db.taskInstances.bulkDelete(ids);
}

export async function deleteTaskInstancesByTemplateId(templateId: number): Promise<number> {
  const db = getDB();
  return db.taskInstances.where('templateId').equals(templateId).delete();
}

// ==================== 复合查询 ====================

export async function getTaskInstanceWithTemplate(
  instanceId: number
): Promise<{ instance: TaskInstance; template?: TaskTemplate } | undefined> {
  const db = getDB();

  const instance = await db.taskInstances.get(instanceId);
  if (!instance) {
    return undefined;
  }

  return { instance, template: instance.template };
}

export async function getTodayTaskInstances(
  userId: number,
  dayEndTime: string = "00:00"
): Promise<Array<{ instance: TaskInstance; template: TaskTemplate }>> {
  const db = getDB();

  const todayStr = getUserCurrentDate(dayEndTime);
  const [year, month, day] = todayStr.split('-').map(Number);
  const today = new Date(year, month - 1, day);

  const startOfDay = getUserStartOfDay(today, dayEndTime);
  const endOfDay = getUserEndOfDay(today, dayEndTime);

  const instances = await db.taskInstances
    .where('startAt')
    .between(startOfDay, endOfDay, true, true)
    .and((instance) => instance.userId === userId)
    .toArray();

  return instances
    .filter((instance) => instance.template)
    .map((instance) => ({
      instance,
      template: instance.template,
    }));
}

export async function getNoDateTaskInstances(
  userId: number
): Promise<Array<{ instance: TaskInstance; template: TaskTemplate }>> {
  const db = getDB();

  const instances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .toArray();

  const noDateInstances = instances.filter((instance) => !instance.startAt);

  return noDateInstances
    .filter((instance) => instance.template)
    .map((instance) => ({
      instance,
      template: instance.template,
    }));
}

export async function getTaskStatistics(
  userId: number
): Promise<{
  total: number;
  completed: number;
  pending: number;
  skipped: number;
}> {
  const db = getDB();

  const instances = await db.taskInstances.where('userId').equals(userId).toArray();

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

export async function getTaskInstancesWithFilter(
  userId: number,
  filterStatus: TaskHistoryFilterStatus,
  offset: number,
  limit: number
): Promise<{ items: TaskHistoryItem[]; hasMore: boolean; total: number }> {
  const db = getDB();

  const allInstances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .toArray();

  let instances = allInstances;
  if (filterStatus !== 'all') {
    instances = instances.filter((i) => i.status === filterStatus);
  }

  instances.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const validItems: TaskHistoryItem[] = [];
  for (const instance of instances) {
    if (instance.template) {
      validItems.push({ instance, template: instance.template });
    }
  }

  const total = validItems.length;

  const paginatedItems = validItems.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    hasMore: offset + limit < total,
    total,
  };
}

// ==================== 积分相关辅助函数 ====================

async function createPointsRecord(
  db: ReturnType<typeof getDB>,
  userId: number,
  instanceId: number,
  amount: number,
  type: PointsHistory['type'],
  description: string
): Promise<void> {
  const now = new Date().toISOString();
  
  await db.pointsHistory.add({
    userId,
    amount,
    type,
    relatedInstanceId: instanceId,
    description,
    createdAt: now,
    updatedAt: now,
  });

  // 更新用户总积分
  const user = await db.users.get(userId);
  if (user) {
    const newTotal = Math.max(0, user.totalPoints + amount);
    await db.users.update(userId, {
      totalPoints: newTotal,
      updatedAt: now
    });
  }
}

async function deductPoints(
  db: ReturnType<typeof getDB>,
  userId: number,
  instanceId: number,
  amount: number,
  description: string
): Promise<void> {
  await createPointsRecord(db, userId, instanceId, -amount, 'task_deduction', description);
}

// ==================== 进度相关方法（新分阶段系统） ====================

/**
 * 更新任务进度（支持分阶段积分，支持回退）
 * @param instanceId 任务实例ID
 * @param newProgress 新的进度值（绝对值，不是增量）
 * @returns 更新结果
 */
export async function updateTaskProgress(
  instanceId: number,
  newProgress: number
): Promise<ProgressUpdateResult> {
  const db = getDB();

  return db.transaction('rw', 
    [db.taskInstances, db.pointsHistory, db.users], 
    async () => {
      const instance = await db.taskInstances.get(instanceId);
      if (!instance) {
        throw new Error('Task instance not found');
      }

      // 检查是否过期
      if (isExpired(instance.expiredAt)) {
        throw new Error('Task instance has expired');
      }

      const template = instance.template;
      const rule = template.completeRule;

      if (!rule || rule.type === 'subtask') {
        throw new Error('Task does not support progress tracking or is subtask type');
      }

      const currentProgress = instance.completeProgress ?? 0;
      const completedStages = instance.completedStages || [];
      
      const result: ProgressUpdateResult = {
        stagesCompleted: [],
        stagesReverted: [],
        pointsEarned: 0,
        pointsDeducted: 0,
        isFullyCompleted: instance.isFullyCompleted || false,
        currentProgress: newProgress,
      };

      // 确保进度不为负数
      newProgress = Math.max(0, newProgress);

      // 1. 检查是否需要回退阶段（进度减少时）
      if (newProgress < currentProgress) {
        for (const completed of [...completedStages]) {
          const stage = rule.stages.find(s => s.id === completed.stageId);
          if (stage && newProgress < stage.threshold) {
            // 回退此阶段
            await deductPoints(
              db,
              instance.userId,
              instanceId,
              completed.points,
              `阶段回退：${stage.threshold}${rule.type === 'time' ? '分钟' : '次'} → ${newProgress}${rule.type === 'time' ? '分钟' : '次'}`
            );

            result.stagesReverted.push(completed.stageId);
            result.pointsDeducted += completed.points;
            
            // 从已完成列表中移除
            const index = completedStages.findIndex(cs => cs.stageId === completed.stageId);
            if (index > -1) {
              completedStages.splice(index, 1);
            }
          }
        }

        // 检查是否需要回退完成额外积分
        if (instance.isFullyCompleted) {
          const allStagesCompleted = rule.stages.every(stage => 
            completedStages.some(cs => cs.stageId === stage.id)
          );
          
          if (!allStagesCompleted || newProgress < Math.max(...rule.stages.map(s => s.threshold))) {
            // 回退完成额外积分
            await deductPoints(
              db,
              instance.userId,
              instanceId,
              rule.completionPoints,
              '任务完成状态回退'
            );
            
            result.pointsDeducted += rule.completionPoints;
            result.isFullyCompleted = false;
          }
        }
      }

      // 2. 检查新完成的阶段（进度增加或未变时）
      if (newProgress >= currentProgress) {
        for (const stage of rule.stages) {
          const alreadyCompleted = completedStages.some(
            cs => cs.stageId === stage.id
          );

          if (newProgress >= stage.threshold && !alreadyCompleted) {
            // 发放阶段积分
            await createPointsRecord(
              db,
              instance.userId,
              instanceId,
              stage.points,
              'task_stage',
              `完成阶段：${stage.threshold}${rule.type === 'time' ? '分钟' : '次'}`
            );

            completedStages.push({
              stageId: stage.id,
              completedAt: new Date().toISOString(),
              points: stage.points,
            });

            result.stagesCompleted.push(stage.id);
            result.pointsEarned += stage.points;
          }
        }

        // 3. 检查是否全部完成
        const allStagesDone = rule.stages.every(stage => 
          completedStages.some(cs => cs.stageId === stage.id)
        );

        if (allStagesDone && !instance.isFullyCompleted) {
          await createPointsRecord(
            db,
            instance.userId,
            instanceId,
            rule.completionPoints,
            'task_completion',
            '任务全部完成'
          );

          result.pointsEarned += rule.completionPoints;
          result.isFullyCompleted = true;
        }
      }

      // 4. 更新实例
      const stagePointsTotal = completedStages.reduce((sum, cs) => sum + cs.points, 0);
      
      await db.taskInstances.update(instanceId, {
        completeProgress: newProgress,
        completedStages,
        stagePointsEarned: stagePointsTotal,
        completionPointsEarned: result.isFullyCompleted ? rule.completionPoints : 0,
        isFullyCompleted: result.isFullyCompleted,
        status: result.isFullyCompleted ? 'completed' : 'pending',
        completedAt: result.isFullyCompleted ? new Date().toISOString() : undefined,
      });

      return result;
    }
  );
}

/**
 * 通过番茄钟完成自动更新进度
 * @param instanceId 任务实例ID
 * @param durationSeconds 专注时长（秒）
 * @returns 更新结果
 */
export async function addPomoToTaskProgress(
  instanceId: number,
  durationSeconds: number
): Promise<ProgressUpdateResult> {
  const db = getDB();
  
  const instance = await db.taskInstances.get(instanceId);
  if (!instance) {
    throw new Error('Task instance not found');
  }

  const durationMinutes = Math.floor(durationSeconds / 60);
  if (durationMinutes <= 0) {
    return {
      stagesCompleted: [],
      stagesReverted: [],
      pointsEarned: 0,
      pointsDeducted: 0,
      isFullyCompleted: instance.isFullyCompleted || false,
      currentProgress: instance.completeProgress || 0,
    };
  }

  const currentProgress = instance.completeProgress || 0;
  return updateTaskProgress(instanceId, currentProgress + durationMinutes);
}

/**
 * 完成/取消完成子任务
 * @param instanceId 任务实例ID
 * @param subtaskIndex 子任务索引
 * @param completed 是否完成
 * @returns 更新结果
 */
export async function completeSubtask(
  instanceId: number,
  subtaskIndex: number,
  completed: boolean
): Promise<SubtaskUpdateResult> {
  const db = getDB();

  return db.transaction('rw',
    [db.taskInstances, db.pointsHistory, db.users],
    async () => {
      const instance = await db.taskInstances.get(instanceId);
      if (!instance) {
        throw new Error('Task instance not found');
      }

      // 检查是否过期
      if (isExpired(instance.expiredAt)) {
        throw new Error('Task instance has expired');
      }

      const template = instance.template;
      const rule = template.completeRule;

      if (!rule || rule.type !== 'subtask') {
        throw new Error('Task is not subtask type');
      }

      if (!rule.subtaskConfig) {
        throw new Error('Subtask config not found');
      }

      const config = rule.subtaskConfig;
      const completedSubtasks = instance.completedSubtasks || 
        instance.subtasks.map(() => false);

      const result: SubtaskUpdateResult = {
        completedCount: 0,
        pointsEarned: 0,
        pointsDeducted: 0,
        isFullyCompleted: instance.isFullyCompleted || false,
      };

      // 获取当前子任务完成状态
      const wasCompleted = completedSubtasks[subtaskIndex];
      
      // 状态未变，直接返回
      if (wasCompleted === completed) {
        result.completedCount = completedSubtasks.filter(Boolean).length;
        return result;
      }

      const subtaskPoints = config.pointsPerSubtask[subtaskIndex] || 0;

      if (completed) {
        // 检查是否已达成完成条件（partial模式下不能超量完成）
        const currentCompletedCount = completedSubtasks.filter(Boolean).length;
        const targetCount = config.mode === 'all' 
          ? instance.subtasks.length 
          : (config.requiredCount || 1);

        // 如果已经达到完成条件，不能再完成更多
        if (currentCompletedCount >= targetCount) {
          throw new Error('Task completion requirement already met');
        }

        // 发放该子任务积分
        await createPointsRecord(
          db,
          instance.userId,
          instanceId,
          subtaskPoints,
          'task_stage',
          `完成子任务：${instance.subtasks[subtaskIndex]}`
        );

        result.pointsEarned = subtaskPoints;
      } else {
        // 取消完成：扣除该子任务积分
        await deductPoints(
          db,
          instance.userId,
          instanceId,
          subtaskPoints,
          `取消子任务：${instance.subtasks[subtaskIndex]}`
        );

        result.pointsDeducted = subtaskPoints;
      }

      // 更新子任务完成状态
      completedSubtasks[subtaskIndex] = completed;

      // 检查是否达到完成条件
      const completedCount = completedSubtasks.filter(Boolean).length;
      const shouldBeFullyCompleted = config.mode === 'all' 
        ? completedCount === instance.subtasks.length
        : completedCount >= (config.requiredCount || 1);

      if (shouldBeFullyCompleted && !instance.isFullyCompleted) {
        // 发放完成额外积分
        await createPointsRecord(
          db,
          instance.userId,
          instanceId,
          rule.completionPoints,
          'task_completion',
          '子任务全部完成'
        );

        result.pointsEarned += rule.completionPoints;
        result.isFullyCompleted = true;
      } else if (!shouldBeFullyCompleted && instance.isFullyCompleted) {
        // 回退完成状态，扣除额外积分
        await deductPoints(
          db,
          instance.userId,
          instanceId,
          rule.completionPoints,
          '子任务完成度不足'
        );

        result.pointsDeducted += rule.completionPoints;
        result.isFullyCompleted = false;
      }

      result.completedCount = completedCount;

      // 更新实例
      await db.taskInstances.update(instanceId, {
        completedSubtasks,
        isFullyCompleted: result.isFullyCompleted,
        status: result.isFullyCompleted ? 'completed' : 'pending',
        completedAt: result.isFullyCompleted ? new Date().toISOString() : undefined,
      });

      return result;
    }
  );
}

/**
 * 获取任务的完成进度百分比
 * @param instance 任务实例
 * @returns 0-100 的百分比
 */
export function getTaskProgressPercent(instance: TaskInstance): number {
  const template = instance.template;
  if (!template?.completeRule) {
    return instance.status === 'completed' ? 100 : 0;
  }

  const rule = template.completeRule;

  if (rule.type === 'subtask') {
    const completedCount = (instance.completedSubtasks || []).filter(Boolean).length;
    const config = rule.subtaskConfig;
    const targetCount = config?.mode === 'all' 
      ? instance.subtasks.length 
      : (config?.requiredCount || 1);
    return Math.min(100, Math.round((completedCount / targetCount) * 100));
  }

  // time/count 类型
  if (rule.stages.length === 0) {
    return instance.status === 'completed' ? 100 : 0;
  }

  const progress = instance.completeProgress ?? 0;
  const maxThreshold = Math.max(...rule.stages.map(s => s.threshold));
  return Math.min(100, Math.round((progress / maxThreshold) * 100));
}

/**
 * 获取下一个待完成的阶段
 */
export function getNextStage(instance: TaskInstance): Stage | undefined {
  const template = instance.template;
  if (!template?.completeRule || template.completeRule.type === 'subtask') {
    return undefined;
  }

  const rule = template.completeRule;
  const completedStages = instance.completedStages || [];

  return rule.stages.find(stage => 
    !completedStages.some(cs => cs.stageId === stage.id)
  );
}

/**
 * 获取已获得的总积分
 */
export function getTotalPointsEarned(instance: TaskInstance): number {
  return (instance.stagePointsEarned || 0) + (instance.completionPointsEarned || 0);
}

/**
 * 检查任务实例是否过期
 */
export function isTaskInstanceExpired(instance: TaskInstance): boolean {
  return isExpired(instance.expiredAt);
}

/**
 * 批量检查并更新过期的 pending 任务实例
 */
export async function checkAndUpdateExpiredTasks(userId: number): Promise<number[]> {
  const db = getDB();
  const now = new Date().toISOString();
  
  const pendingInstances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .and(instance => instance.status === 'pending' && !!instance.expiredAt)
    .toArray();
  
  const expiredInstances = pendingInstances.filter(instance => isExpired(instance.expiredAt));
  
  if (expiredInstances.length === 0) {
    return [];
  }
  
  const updatePromises = expiredInstances.map(instance => 
    db.taskInstances.update(instance.id!, {
      status: 'skipped',
      completedAt: now,
    })
  );
  
  await Promise.all(updatePromises);
  
  return expiredInstances.map(instance => instance.id!);
}

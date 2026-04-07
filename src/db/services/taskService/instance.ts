import { getDB } from '../../index';
import type { TaskInstance, TaskStatus } from '../../types';
import { getUserStartOfDay, getUserEndOfDay } from '@/libs/time';

import { createPointsRecord } from './points';

export async function createTaskInstance(
  instance: Omit<TaskInstance, 'id' | 'createdAt'>
): Promise<string> {
  const db = getDB();

  const newInstance: TaskInstance = {
    ...instance,
    id: '' as string,
    createdAt: new Date().toISOString(),
  };

  return db.taskInstances.add(newInstance as unknown as TaskInstance);
}

export async function createTaskInstances(
  instances: Omit<TaskInstance, 'id' | 'createdAt'>[]
): Promise<string[]> {
  const db = getDB();

  const now = new Date().toISOString();
  const newInstances: TaskInstance[] = instances.map((instance) => ({
    ...instance,
    id: '' as string,
    createdAt: now,
  }));

  return db.taskInstances.bulkAdd(newInstances as unknown as TaskInstance[], { allKeys: true });
}

export async function getAllTaskInstances(userId?: number): Promise<TaskInstance[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.taskInstances.where('userId').equals(userId).toArray();
  }
  return db.taskInstances.toArray();
}

export async function getTaskInstanceById(id: string): Promise<TaskInstance | undefined> {
  const db = getDB();
  return db.taskInstances.get(id);
}

export async function getTaskInstancesByTemplateId(templateId: string): Promise<TaskInstance[]> {
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
  id: string,
  updates: Partial<Omit<TaskInstance, 'id'>>
): Promise<number> {
  const db = getDB();
  return db.taskInstances.update(id, updates);
}

export async function completeTaskInstance(id: string): Promise<number> {
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

export async function skipTaskInstance(id: string): Promise<number> {
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

export async function resetTaskInstance(id: string): Promise<number> {
  const db = getDB();

  return db.transaction('rw',
    [db.taskInstances, db.pointsHistory, db.users],
    async () => {
      const instance = await db.taskInstances.get(id);
      if (!instance) {
        throw new Error('Task instance not found');
      }

      const template = instance.template;
      const rule = template.completeRule;

      let totalPointsToDeduct = 0;

      if (rule?.type === 'subtask' && rule.subtaskConfig) {
        const completedSubtasks = instance.completedSubtasks || [];
        const pointsPerSubtask = rule.subtaskConfig.pointsPerSubtask || [];

        completedSubtasks.forEach((isCompleted, index) => {
          if (isCompleted) {
            totalPointsToDeduct += pointsPerSubtask[index] || 0;
          }
        });

        if (instance.isFullyCompleted) {
          totalPointsToDeduct += rule.completionPoints || 0;
        }

        if (totalPointsToDeduct > 0) {
          await createPointsRecord(
            db,
            instance.userId,
            id,
            -totalPointsToDeduct,
            'task_undo',
            `撤销任务：${template.title}`
          );
        }
      } else if (rule?.type === 'simple') {
        if (instance.status === 'completed') {
          await createPointsRecord(
            db,
            instance.userId,
            id,
            -(rule.completionPoints || 0),
            'task_undo',
            `撤销任务：${template.title}`
          );
        }
      } else if (rule) {
        totalPointsToDeduct = (instance.stagePointsEarned || 0) + (instance.completionPointsEarned || 0);

        if (totalPointsToDeduct > 0) {
          await createPointsRecord(
            db,
            instance.userId,
            id,
            -totalPointsToDeduct,
            'task_undo',
            `撤销任务：${template.title}`
          );
        }
      }

      const updates: Partial<TaskInstance> = {
        status: 'pending',
        completedAt: undefined,
        completeProgress: 0,
        completedStages: [],
        stagePointsEarned: 0,
        completionPointsEarned: 0,
        isFullyCompleted: false,
      };

      if (rule?.type === 'subtask') {
        updates.completedSubtasks = instance.subtasks.map(() => false);
      }

      return db.taskInstances.update(id, updates);
    }
  );
}

export async function deleteTaskInstance(id: string): Promise<void> {
  const db = getDB();
  return db.taskInstances.delete(id);
}

export async function deleteTaskInstances(ids: string[]): Promise<void> {
  const db = getDB();
  return db.taskInstances.bulkDelete(ids);
}

export async function deleteTaskInstancesByTemplateId(templateId: string): Promise<number> {
  const db = getDB();
  return db.taskInstances.where('templateId').equals(templateId).delete();
}
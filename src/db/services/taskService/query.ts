import { getDB } from '../../index';
import type { TaskInstance, TaskTemplate } from '../../types';
import { getUserCurrentDate } from '@/libs/time';

export type TaskHistoryFilterStatus = 'all' | 'pending' | 'completed' | 'skipped';

export interface TaskHistoryItem {
  instance: TaskInstance;
  template: TaskTemplate;
}

export async function getTaskInstanceWithTemplate(
  instanceId: string
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

  const instances = await db.taskInstances
    .where('instanceDate')
    .equals(todayStr)
    .and(
      (instance) =>
        instance.userId === userId &&
        (instance.status === 'pending' || instance.status === 'completed') &&
        !!instance.template
    )
    .toArray();

  return instances.map((instance) => ({
    instance,
    template: instance.template!,
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

export type { TaskInstance, TaskTemplate, TaskStatus } from '../../types';
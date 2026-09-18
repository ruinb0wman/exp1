import { getDB } from '../../index';
import type { TaskTemplate, RepeatMode } from '../../types';
import { sortTaskTemplates } from '@/libs/task';

export async function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>
): Promise<string> {
  const db = getDB();

  const now = new Date().toISOString();

  return db.transaction('rw', db.taskTemplates, async () => {
    // 新模板追加到该用户末尾
    const existing = await db.taskTemplates
      .where('userId')
      .equals(template.userId)
      .toArray();
    const maxOrder = existing.reduce<number>(
      (max, t) => (typeof t.sortOrder === 'number' ? Math.max(max, t.sortOrder) : max),
      -1
    );

    const newTemplate: TaskTemplate = {
      ...template,
      sortOrder: maxOrder + 1,
      id: '' as string,
      createdAt: now,
    };

    return db.taskTemplates.add(newTemplate as unknown as TaskTemplate);
  });
}

export async function getAllTaskTemplates(userId?: number): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.taskTemplates.where('userId').equals(userId).toArray();
    return sortTaskTemplates(templates);
  }
  return sortTaskTemplates(await db.taskTemplates.toArray());
}

export async function getEnabledTaskTemplates(userId?: number): Promise<TaskTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.taskTemplates.where('userId').equals(userId).toArray();
    return sortTaskTemplates(templates.filter(t => t.enabled));
  }
  return sortTaskTemplates(await db.taskTemplates.filter(t => t.enabled).toArray());
}

export async function getTaskTemplateById(id: string): Promise<TaskTemplate | undefined> {
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
    return sortTaskTemplates(templates.filter(t => t.repeatMode === repeatMode));
  }
  return sortTaskTemplates(await db.taskTemplates.where('repeatMode').equals(repeatMode).toArray());
}

/**
 * 按数组下标重写模板顺序（index 即 sortOrder）
 *
 * 调用方传完整顺序列表（包含被筛选隐藏的模板），一次 bulkUpdate 落库。
 */
export async function reorderTaskTemplates(orderedIds: string[]): Promise<void> {
  const db = getDB();

  if (orderedIds.length === 0) return;

  await db.transaction('rw', db.taskTemplates, async () => {
    await db.taskTemplates.bulkUpdate(
      orderedIds.map((id, index) => ({ key: id, changes: { sortOrder: index } }))
    );
  });
}

export async function updateTaskTemplate(
  id: string,
  updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt'>>
): Promise<number> {
  const db = getDB();

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return db.taskTemplates.update(id, updateData);
}

export async function disableTaskTemplate(id: string): Promise<number> {
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
  id: string,
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
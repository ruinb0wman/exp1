import { getDB } from '../../index';
import type { TaskTemplate, RepeatMode } from '../../types';
import { sortTaskTemplates } from '@/libs/task';

export async function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDB();

  const now = new Date().toISOString();

  const newTemplate: TaskTemplate = {
    ...template,
    id: '' as string,
    createdAt: now,
  };

  return db.taskTemplates.add(newTemplate as unknown as TaskTemplate);
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
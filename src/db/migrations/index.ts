import type { DB } from "../types";

export function migration(db: DB) {
  return db.version(1).stores(v1);
}

const v1 = {
  taskTemplates: '++id, userId, repeatMode, enabled, *subtasks',
  taskInstances: '++id, userId, templateId, scheduledDate, status, [templateId+startAt]',
  rewardTemplates: '++id, userId, replenishmentMode, enabled',
  rewardInstances: '++id, templateId, userId, status, expiresAt',
  users: '++id, name',
  pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]'
}

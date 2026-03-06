import type { DB } from "../types";

export function migration(db: DB) {
  // Version 1 (初始版本)
  db.version(1).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks',
    taskInstances: '++id, userId, templateId, scheduledDate, status, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]'
  });

  // Version 2: 修改 taskInstances 索引，将 scheduledDate 改为 startAt
  db.version(2).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]'
  });

  // Version 3: 保留 v2 的 schema（用于强制升级）
  db.version(3).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]'
  });
}

import type { DB } from "../types";

export function migration(db: DB) {
  // Version 1: 初始版本，包含所有表结构
  db.version(1).stores({
    // 业务表
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt',
    
    // 同步影子表
    syncMetadata: '++id, [table+localId], syncId, [table+syncId]',
    syncSnapshots: '++id, sessionId, [table+syncId], syncedAt',
    syncSessions: '++id, sessionId, device, status, startedAt',
    syncBackups: '++id, sessionId, table',
    syncConfig: 'key'
  });
}

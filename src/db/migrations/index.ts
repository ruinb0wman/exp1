import type { DB } from "../types";

export function migration(db: DB) {
  // Version 1: 初始版本，包含所有表结构
  db.version(1).stores({
    // 业务表
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, updatedAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt, updatedAt',
    users: '++id, name, updatedAt',
    pointsHistory: '++id, userId, type, createdAt, updatedAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt',
    
    // 同步相关表（简化后只保留必要的）
    syncBackups: '++id, sessionId, table',
    syncConfig: 'key'
  });
}

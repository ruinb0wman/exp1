import type { DB } from "../types";

export function migration(db: DB) {
  db.version(1).stores({
    taskTemplates: 'id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: 'id, userId, templateId, instanceDate, status, createdAt, updatedAt, [instanceDate+userId+status]',
    rewardTemplates: 'id, userId, replenishmentMode, enabled',
    rewardInstances: 'id, templateId, userId, status, expiresAt, updatedAt',
    users: 'id, name, updatedAt',
    pointsHistory: 'id, userId, type, relatedInstanceId, stageId, createdAt, updatedAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt',
    syncBackups: '++id, sessionId, table',
    syncConfig: 'key'
  });
}

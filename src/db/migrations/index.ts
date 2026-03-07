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

  // Version 4: 添加番茄钟表
  db.version(4).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt'
  });

  // Version 5: 添加任务完成规则字段和 dayEndTime
  db.version(5).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt'
  });

  // Version 6: 将 taskInstances 的 createAt 字段重命名为 createdAt，并添加索引
  db.version(6).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt'
  }).upgrade(async (tx) => {
    // 迁移数据：将 createAt 重命名为 createdAt
    const instances = await tx.table('taskInstances').toArray();
    for (const inst of instances) {
      if (inst.createAt && !inst.createdAt) {
        await tx.table('taskInstances').update(inst.id, {
          createdAt: inst.createAt,
          createAt: undefined
        });
      }
    }
  });

  // Version 7: 添加 taskTemplates 的 startAt 字段
  db.version(7).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt'
  });
}

import type { DB } from "../types";
import { migrationV10 } from "../sync/migrations";

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

  // Version 8: 添加 rewardTemplates 的 currentStock 字段
  db.version(8).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt'
  }).upgrade(async (tx) => {
    // 初始化 currentStock：将现有 available 状态的实例数量作为初始库存
    const templates = await tx.table('rewardTemplates').toArray();
    for (const template of templates) {
      if (template.currentStock === undefined) {
        // 计算当前可用的实例数量作为初始库存
        const availableCount = await tx.table('rewardInstances')
          .where('templateId')
          .equals(template.id)
          .and((i: { status: string }) => i.status === 'available')
          .count();
        
        await tx.table('rewardTemplates').update(template.id, {
          currentStock: availableCount
        });
      }
    }
  });

  // Version 9: 将 pointsHistory 的 relatedEntityId 重命名为 relatedTemplateId
  // 并统一存储 templateId 而非 instanceId
  db.version(9).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt'
  }).upgrade(async (tx) => {
    const histories = await tx.table('pointsHistory').toArray();

    for (const history of histories) {
      if (history.relatedEntityId !== undefined) {
        let templateId: number | null = null;

        // task_reward 和 task_undo: 需要从 instanceId 获取 templateId
        if (history.type === 'task_reward' || history.type === 'task_undo') {
          const instance = await tx.table('taskInstances').get(history.relatedEntityId);
          if (instance) {
            templateId = instance.templateId;
          } else {
            // instance 已被删除，删除此 history 记录
            await tx.table('pointsHistory').delete(history.id);
            continue;
          }
        } else if (history.type === 'reward_exchange') {
          // reward_exchange: relatedEntityId 已经是 templateId
          templateId = history.relatedEntityId;
        }

        // 更新记录：删除旧字段，添加新字段
        if (templateId !== null) {
          await tx.table('pointsHistory').update(history.id, {
            relatedTemplateId: templateId,
            relatedEntityId: undefined
          });
        }
      }
    }
  });

  // Version 10: 添加同步系统影子表
  migrationV10(db);
}

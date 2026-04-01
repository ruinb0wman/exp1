import type { DB } from "../types";

export function migration(db: DB) {
  // Version 1: 初始版本
  db.version(1).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, updatedAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt, updatedAt',
    users: '++id, name, updatedAt',
    pointsHistory: '++id, userId, type, createdAt, updatedAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt',
    syncBackups: '++id, sessionId, table',
    syncConfig: 'key'
  });

  // Version 2: 分阶段完成规则系统
  db.version(2).upgrade(async (tx) => {
    // 迁移 TaskInstance 表，添加新字段
    await tx.table('taskInstances').toCollection().modify((instance) => {
      // 初始化新字段
      instance.completedStages = instance.completedStages || [];
      instance.stagePointsEarned = instance.stagePointsEarned || 0;
      instance.completionPointsEarned = instance.completionPointsEarned || 0;
      instance.completedSubtasks = instance.completedSubtasks || 
        (instance.subtasks || []).map(() => false);
      instance.isFullyCompleted = instance.isFullyCompleted || 
        (instance.status === 'completed');
    });

    // 迁移 TaskTemplate 表，转换旧的 completeRule 格式
    await tx.table('taskTemplates').toCollection().modify((template) => {
      // 如果存在旧的 completeRule（string类型），转换为新格式
      if (template.completeRule && typeof template.completeRule === 'string') {
        const oldType = template.completeRule as 'time' | 'count';
        const oldTarget = template.completeTarget || (oldType === 'time' ? 25 : 1);
        const oldReward = template.rewardPoints || 0;
        
        // 转换为新格式：单阶段规则
        template.completeRule = {
          type: oldType,
          stages: oldTarget > 0 ? [{
            id: `legacy_${Date.now()}`,
            threshold: oldTarget,
            points: oldReward
          }] : [],
          completionPoints: 0  // 旧逻辑已包含在阶段中
        };
      }
      
      // 如果没有 completeRule，保持 undefined（简单任务）
    });

    // 迁移 Users 表，初始化 totalPoints 字段
    await tx.table('users').toCollection().modify((user) => {
      if (typeof user.totalPoints !== 'number') {
        user.totalPoints = 0;
      }
    });
  });
}

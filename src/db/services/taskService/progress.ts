import { getDB } from '../../index';
import type { ProgressUpdateResult, SubtaskUpdateResult } from '../../types';
import { isExpired } from '@/libs/time';

import { createPointsRecord, deductPoints } from './points';

export async function updateTaskProgress(
  instanceId: string,
  newProgress: number
): Promise<ProgressUpdateResult> {
  const db = getDB();

  return db.transaction('rw', 
    [db.taskInstances, db.pointsHistory, db.users], 
    async () => {
      const instance = await db.taskInstances.get(instanceId);
      if (!instance) {
        throw new Error('Task instance not found');
      }

      if (isExpired(instance.expiredAt)) {
        throw new Error('Task instance has expired');
      }

      const template = instance.template;
      const rule = template.completeRule;

      if (!rule || rule.type === 'subtask') {
        throw new Error('Task does not support progress tracking or is subtask type');
      }

      const currentProgress = instance.completeProgress ?? 0;
      const completedStages = instance.completedStages || [];
      
      const result: ProgressUpdateResult = {
        stagesCompleted: [],
        stagesReverted: [],
        pointsEarned: 0,
        pointsDeducted: 0,
        isFullyCompleted: instance.isFullyCompleted || false,
        currentProgress: newProgress,
      };

      newProgress = Math.max(0, newProgress);

      if (newProgress < currentProgress) {
        for (const completed of [...completedStages]) {
          const stage = rule.stages.find(s => s.id === completed.stageId);
          if (stage && newProgress < stage.threshold) {
            await deductPoints(
              db,
              instance.userId,
              instanceId,
              completed.points,
              `阶段回退：${stage.threshold}${rule.type === 'time' ? '分钟' : '次'} → ${newProgress}${rule.type === 'time' ? '分钟' : '次'}`
            );

            result.stagesReverted.push(completed.stageId);
            result.pointsDeducted += completed.points;
            
            const index = completedStages.findIndex(cs => cs.stageId === completed.stageId);
            if (index > -1) {
              completedStages.splice(index, 1);
            }
          }
        }

        if (instance.isFullyCompleted) {
          const allStagesCompleted = rule.stages.every(stage => 
            completedStages.some(cs => cs.stageId === stage.id)
          );
          
          if (!allStagesCompleted || newProgress < Math.max(...rule.stages.map(s => s.threshold))) {
            await deductPoints(
              db,
              instance.userId,
              instanceId,
              rule.completionPoints,
              '任务完成状态回退'
            );
            
            result.pointsDeducted += rule.completionPoints;
            result.isFullyCompleted = false;
          }
        }
      }

      if (newProgress >= currentProgress) {
        for (const stage of rule.stages) {
          const alreadyCompleted = completedStages.some(
            cs => cs.stageId === stage.id
          );

          if (newProgress >= stage.threshold && !alreadyCompleted) {
            await createPointsRecord(
              db,
              instance.userId,
              instanceId,
              stage.points,
              'task_stage',
              `完成阶段：${stage.threshold}${rule.type === 'time' ? '分钟' : '次'}`,
              stage.id
            );

            completedStages.push({
              stageId: stage.id,
              completedAt: new Date().toISOString(),
              points: stage.points,
            });

            result.stagesCompleted.push(stage.id);
            result.pointsEarned += stage.points;
          }
        }

        const allStagesDone = rule.stages.every(stage => 
          completedStages.some(cs => cs.stageId === stage.id)
        );

        if (allStagesDone && !instance.isFullyCompleted) {
          await createPointsRecord(
            db,
            instance.userId,
            instanceId,
            rule.completionPoints,
            'task_completion',
            '任务全部完成'
          );

          result.pointsEarned += rule.completionPoints;
          result.isFullyCompleted = true;
        }
      }

      const stagePointsTotal = completedStages.reduce((sum, cs) => sum + cs.points, 0);
      
      await db.taskInstances.update(instanceId, {
        completeProgress: newProgress,
        completedStages,
        stagePointsEarned: stagePointsTotal,
        completionPointsEarned: result.isFullyCompleted ? rule.completionPoints : 0,
        isFullyCompleted: result.isFullyCompleted,
        status: result.isFullyCompleted ? 'completed' : 'pending',
        completedAt: result.isFullyCompleted ? new Date().toISOString() : undefined,
      });

      return result;
    }
  );
}

export async function addPomoToTaskProgress(
  instanceId: string,
  durationSeconds: number
): Promise<ProgressUpdateResult> {
  const db = getDB();
  
  const instance = await db.taskInstances.get(instanceId);
  if (!instance) {
    throw new Error('Task instance not found');
  }

  const durationMinutes = Math.floor(durationSeconds / 60);
  if (durationMinutes <= 0) {
    return {
      stagesCompleted: [],
      stagesReverted: [],
      pointsEarned: 0,
      pointsDeducted: 0,
      isFullyCompleted: instance.isFullyCompleted || false,
      currentProgress: instance.completeProgress || 0,
    };
  }

  const currentProgress = instance.completeProgress || 0;
  return updateTaskProgress(instanceId, currentProgress + durationMinutes);
}

export async function completeSubtask(
  instanceId: string,
  subtaskIndex: number,
  completed: boolean
): Promise<SubtaskUpdateResult> {
  const db = getDB();

  return db.transaction('rw',
    [db.taskInstances, db.pointsHistory, db.users],
    async () => {
      const instance = await db.taskInstances.get(instanceId);
      if (!instance) {
        throw new Error('Task instance not found');
      }

      if (isExpired(instance.expiredAt)) {
        throw new Error('Task instance has expired');
      }

      const template = instance.template;
      const rule = template.completeRule;

      if (!rule || rule.type !== 'subtask') {
        throw new Error('Task is not subtask type');
      }

      if (!rule.subtaskConfig) {
        throw new Error('Subtask config not found');
      }

      const config = rule.subtaskConfig;
      const completedSubtasks = instance.completedSubtasks || 
        instance.subtasks.map(() => false);

      let currentStagePoints = instance.stagePointsEarned || 0;
      let currentCompletionPoints = instance.completionPointsEarned || 0;

      const result: SubtaskUpdateResult = {
        completedCount: 0,
        pointsEarned: 0,
        pointsDeducted: 0,
        isFullyCompleted: instance.isFullyCompleted || false,
      };

      const wasCompleted = completedSubtasks[subtaskIndex];
      
      if (wasCompleted === completed) {
        result.completedCount = completedSubtasks.filter(Boolean).length;
        return result;
      }

      const subtaskPoints = config.pointsPerSubtask[subtaskIndex] || 0;

      if (completed) {
        const currentCompletedCount = completedSubtasks.filter(Boolean).length;
        const targetCount = config.mode === 'all' 
          ? instance.subtasks.length 
          : (config?.requiredCount || 1);

        if (currentCompletedCount >= targetCount) {
          throw new Error('Task completion requirement already met');
        }

        await createPointsRecord(
          db,
          instance.userId,
          instanceId,
          subtaskPoints,
          'task_stage',
          `完成子任务：${instance.subtasks[subtaskIndex]}`,
          String(subtaskIndex)
        );

        currentStagePoints += subtaskPoints;
        result.pointsEarned = subtaskPoints;
      } else {
        await deductPoints(
          db,
          instance.userId,
          instanceId,
          subtaskPoints,
          `取消子任务：${instance.subtasks[subtaskIndex]}`
        );

        currentStagePoints = Math.max(0, currentStagePoints - subtaskPoints);
        result.pointsDeducted = subtaskPoints;
      }

      completedSubtasks[subtaskIndex] = completed;

      const completedCount = completedSubtasks.filter(Boolean).length;
      const shouldBeFullyCompleted = config.mode === 'all' 
        ? completedCount === instance.subtasks.length
        : completedCount >= (config.requiredCount || 1);

      if (shouldBeFullyCompleted && !instance.isFullyCompleted) {
        await createPointsRecord(
          db,
          instance.userId,
          instanceId,
          rule.completionPoints,
          'task_completion',
          '子任务全部完成'
        );

        currentCompletionPoints += rule.completionPoints;
        result.pointsEarned += rule.completionPoints;
        result.isFullyCompleted = true;
      } else if (!shouldBeFullyCompleted && instance.isFullyCompleted) {
        await deductPoints(
          db,
          instance.userId,
          instanceId,
          rule.completionPoints,
          '子任务完成度不足'
        );

        currentCompletionPoints = Math.max(0, currentCompletionPoints - rule.completionPoints);
        result.pointsDeducted += rule.completionPoints;
        result.isFullyCompleted = false;
      }

      result.completedCount = completedCount;

      await db.taskInstances.update(instanceId, {
        completedSubtasks,
        isFullyCompleted: result.isFullyCompleted,
        status: result.isFullyCompleted ? 'completed' : 'pending',
        completedAt: result.isFullyCompleted ? new Date().toISOString() : undefined,
        stagePointsEarned: currentStagePoints,
        completionPointsEarned: currentCompletionPoints,
      });

      return result;
    }
  );
}

export async function checkAndUpdateExpiredTasks(userId: number): Promise<string[]> {
  const db = getDB();
  const now = new Date().toISOString();
  
  const pendingInstances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .and(instance => instance.status === 'pending' && !!instance.expiredAt)
    .toArray();
  
  const expiredInstances = pendingInstances.filter(instance => isExpired(instance.expiredAt));
  
  if (expiredInstances.length === 0) {
    return [];
  }
  
  const updatePromises = expiredInstances.map(instance => 
    db.taskInstances.update(instance.id!, {
      status: 'skipped',
      completedAt: now,
    })
  );
  
  await Promise.all(updatePromises);
  
  return expiredInstances.map(instance => instance.id!);
}
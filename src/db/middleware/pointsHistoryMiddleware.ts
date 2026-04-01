import type { TaskInstance, RewardInstance } from '@/db/types';
import type { DB } from '@/db/types';
import { getIsSyncing } from '@/services/sync/syncState';

/**
 * 创建积分历史中间件
 * 使用 Dexie Hooks API 监听任务状态变更和奖励兑换，自动记录积分历史
 * 
 * 注意：分阶段任务的积分由 taskService 直接管理，中间件只处理简单任务和奖励兑换
 */
export function createPointsHistoryMiddleware() {
  return {
    /**
     * 注册 hooks 到数据库实例
     */
    register(db: DB) {
      // 监听 taskInstances 的更新（完成任务/撤销完成）
      // 只处理没有 completeRule 的简单任务
      db.taskInstances.hook('updating', function (mods, primKey, obj, trans) {
        // 同步期间跳过自动创建 pointsHistory
        if (getIsSyncing()) return;
        
        const oldInstance = obj as TaskInstance;
        const newInstance = { ...oldInstance, ...mods } as TaskInstance;

        // 只处理没有 completeRule 的简单任务
        // 有 completeRule 的任务积分由 taskService 直接管理
        if (newInstance.template?.completeRule) {
          return;
        }

        const oldStatus = oldInstance.status;
        const newStatus = newInstance.status;

        // 场景1: 完成任务 → 发放积分
        if (oldStatus !== 'completed' && newStatus === 'completed') {
          const rewardPoints = newInstance.template?.rewardPoints || 0;
          if (rewardPoints > 0) {
            trans.on('complete', async () => {
              try {
                const now = new Date().toISOString();
                await db.pointsHistory.add({
                  userId: newInstance.userId,
                  amount: rewardPoints,
                  type: 'task_reward',
                  relatedInstanceId: primKey as number,
                  description: '完成简单任务',
                  createdAt: now,
                  updatedAt: now,
                });

                // 更新用户总积分
                const user = await db.users.get(newInstance.userId);
                if (user) {
                  await db.users.update(newInstance.userId, {
                    totalPoints: (user.totalPoints || 0) + rewardPoints,
                    updatedAt: now
                  });
                }
              } catch (error) {
                console.error('[PointsHistoryMiddleware] Failed to add task reward:', error);
              }
            });
          }
        }

        // 场景2: 撤销完成 → 扣除积分
        if (oldStatus === 'completed' && newStatus !== 'completed') {
          const rewardPoints = oldInstance.template?.rewardPoints || 0;
          if (rewardPoints > 0) {
            trans.on('complete', async () => {
              try {
                const now = new Date().toISOString();
                await db.pointsHistory.add({
                  userId: newInstance.userId,
                  amount: -rewardPoints,
                  type: 'task_undo',
                  relatedInstanceId: primKey as number,
                  description: '撤销简单任务',
                  createdAt: now,
                  updatedAt: now,
                });

                // 更新用户总积分
                const user = await db.users.get(newInstance.userId);
                if (user) {
                  await db.users.update(newInstance.userId, {
                    totalPoints: Math.max(0, (user.totalPoints || 0) - rewardPoints),
                    updatedAt: now
                  });
                }
              } catch (error) {
                console.error('[PointsHistoryMiddleware] Failed to add task undo:', error);
              }
            });
          }
        }
      });

      // 监听 rewardInstances 的创建（兑换奖励）
      db.rewardInstances.hook('creating', function (_primKey, obj, _trans) {
        // 同步期间跳过自动创建 pointsHistory
        if (getIsSyncing()) return;
        
        const instance = obj as RewardInstance;
        const pointsCost = instance.template?.pointsCost || 0;

        if (pointsCost > 0) {
          this.onsuccess = async (actualPrimKey) => {
            try {
              const now = new Date().toISOString();
              await db.pointsHistory.add({
                userId: instance.userId,
                amount: -pointsCost,
                type: 'reward_exchange',
                relatedInstanceId: actualPrimKey as number,
                description: '兑换奖励',
                createdAt: now,
                updatedAt: now,
              });

              // 更新用户总积分
              const user = await db.users.get(instance.userId);
              if (user) {
                await db.users.update(instance.userId, {
                  totalPoints: Math.max(0, (user.totalPoints || 0) - pointsCost),
                  updatedAt: now
                });
              }
            } catch (error) {
              console.error('[PointsHistoryMiddleware] Failed to add reward exchange:', error);
            }
          };

          this.onerror = (error) => {
            console.error('[PointsHistoryMiddleware] Failed to create reward instance:', error);
          };
        }
      });
    },
  };
}

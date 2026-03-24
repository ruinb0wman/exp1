import type { TaskInstance, RewardInstance } from '@/db/types';
import type { DB } from '@/db/types';

/**
 * 创建积分历史中间件
 * 使用 Dexie Hooks API 监听任务状态变更和奖励兑换，自动记录积分历史
 */
export function createPointsHistoryMiddleware() {
  return {
    /**
     * 注册 hooks 到数据库实例
     */
    register(db: DB) {
      // 监听 taskInstances 的更新（完成任务/撤销完成）
      db.taskInstances.hook('updating', function (mods, primKey, obj, trans) {
        const oldInstance = obj as TaskInstance;
        const newInstance = { ...oldInstance, ...mods } as TaskInstance;

        const oldStatus = oldInstance.status;
        const newStatus = newInstance.status;

        // 场景1: 完成任务 → 发放积分
        if (oldStatus !== 'completed' && newStatus === 'completed') {
          const rewardPoints = newInstance.template?.rewardPoints || 0;
          if (rewardPoints > 0) {
            // 在事务完成后添加积分记录
            trans.on('complete', async () => {
              try {
                await db.pointsHistory.add({
                  userId: newInstance.userId,
                  amount: rewardPoints,
                  type: 'task_reward',
                  relatedInstanceId: primKey as number,
                  createdAt: new Date().toISOString(),
                });
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
            // 在事务完成后添加积分记录
            trans.on('complete', async () => {
              try {
                await db.pointsHistory.add({
                  userId: newInstance.userId,
                  amount: -rewardPoints,
                  type: 'task_undo',
                  relatedInstanceId: primKey as number,
                  createdAt: new Date().toISOString(),
                });
              } catch (error) {
                console.error('[PointsHistoryMiddleware] Failed to add task undo:', error);
              }
            });
          }
        }
      });

      // 监听 rewardInstances 的创建（兑换奖励）
      db.rewardInstances.hook('creating', function (primKey, obj, trans) {
        const instance = obj as RewardInstance;
        const pointsCost = instance.template?.pointsCost || 0;

        if (pointsCost > 0) {
          // 在事务完成后添加积分记录
          trans.on('complete', async () => {
            try {
              await db.pointsHistory.add({
                userId: instance.userId,
                amount: -pointsCost,
                type: 'reward_exchange',
                relatedInstanceId: primKey as number,
                createdAt: new Date().toISOString(),
              });
            } catch (error) {
              console.error('[PointsHistoryMiddleware] Failed to add reward exchange:', error);
            }
          });
        }
      });
    },
  };
}

import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { getDB } from '../index';

/**
 * v8：模板自定义显示顺序
 *
 * 单独一个文件：上面的 index.test.ts 已经先打开过 getDB() 单例（升到 v8），
 * 同文件内再模拟「v7 → v8」拿不到真实的升级路径（单例已缓存且库已是 v8）。
 * vitest 按文件隔离模块，这里能拿到全新的 fake-indexeddb 与全新单例。
 *
 * 注意：本文件用 enabled:false 回避了升级期间的实例生成检查；
 * 「enabled:true 时中间件的补生成行为」由 index.v8.middleware.test.ts 覆盖。
 */
describe('migration v8 - 模板 sortOrder 回填', () => {
  it('按 createdAt 顺序为每个用户的模板编号 0..n-1', async () => {
    const DB_NAME = 'exp-v7'; // 同一个库名才能触发真实升级路径

    // 1. 以 v7 结构建库并写入无 sortOrder 的旧数据（刻意乱序插入）
    const legacy = new Dexie(DB_NAME);
    legacy.version(7).stores({
      taskTemplates: 'id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
      taskInstances: 'id, userId, templateId, instanceDate, status, createdAt, updatedAt, [instanceDate+userId+status]',
      rewardTemplates: 'id, userId, replenishmentMode, enabled',
      users: 'id, name, updatedAt',
      pointsHistory: 'id, userId, type, relatedInstanceId, stageId, createdAt, updatedAt, [userId+createdAt]',
      pomoSessions: '++id, userId, taskId, mode, status, startedAt',
      replenishmentRecords: 'id, templateId, userId, scheduledDate, createdAt, [templateId+createdAt]',
      achievements: 'id, userId, status, createdAt, [userId+status]',
      rewardPurchases: 'id, userId, templateId, createdAt, [userId+createdAt]',
    });

    await legacy.open();
    const legacyTemplate = (id: string, userId: number, createdAt: string) => ({
      id,
      userId,
      title: id,
      repeatMode: 'daily',
      endCondition: 'manual',
      enabled: false, // 避免升级期间的实例生成检查（该路径见 index.v8.middleware.test.ts）
      subtasks: [],
      createdAt,
    });
    await legacy.table('taskTemplates').bulkAdd([
      legacyTemplate('t-late', 1, '2026-03-01T00:00:00.000Z'),
      legacyTemplate('t-early', 1, '2026-01-01T00:00:00.000Z'),
      legacyTemplate('t-mid', 1, '2026-02-01T00:00:00.000Z'),
      legacyTemplate('t-other-user', 2, '2026-05-01T00:00:00.000Z'),
    ]);
    legacy.close();

    // 2. 用当前 schema 打开，触发 v8 升级
    const db = getDB();
    await db.open();

    expect((await db.taskTemplates.get('t-early'))!.sortOrder).toBe(0);
    expect((await db.taskTemplates.get('t-mid'))!.sortOrder).toBe(1);
    expect((await db.taskTemplates.get('t-late'))!.sortOrder).toBe(2);
    // 另一个用户独立编号
    expect((await db.taskTemplates.get('t-other-user'))!.sortOrder).toBe(0);

    // 3. 升级后顺序稳定：再打开一次不改变结果
    const before = await db.taskTemplates.toArray();
    await db.close();
    await db.open();
    expect((await db.taskTemplates.toArray()).map((t) => [t.id, t.sortOrder])).toEqual(
      before.map((t) => [t.id, t.sortOrder])
    );
  });
});

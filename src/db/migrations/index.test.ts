import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { getDB } from '../index';

/**
 * v6 迁移：购买即消费
 * - 删除 rewardInstances（背包）表
 * - 新增 rewardPurchases 表
 * - 清除模板上的 validDuration，并给缺失的模板补 pointsPerYuan = 1
 *
 * 这里刻意先用 v5 打开同一个库写入旧数据，再用 getDB() 触发真实升级路径，
 * 确保老用户升级后模板仍可读、比例有兜底、背包表被移除。
 */
describe('migration v6 - 购买即消费', () => {
  it('老库升级后补齐比例、清除有效期、移除背包表', async () => {
    const DB_NAME = 'exp-v7';

    // 1. 以 v5 结构建库并写入旧数据
    const legacy = new Dexie(DB_NAME);
    legacy.version(5).stores({
      taskTemplates: 'id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
      taskInstances: 'id, userId, templateId, instanceDate, status, createdAt, updatedAt, [instanceDate+userId+status]',
      rewardTemplates: 'id, userId, replenishmentMode, enabled',
      rewardInstances: 'id, templateId, userId, status, expiresAt, updatedAt',
      users: 'id, name, updatedAt',
      pointsHistory: 'id, userId, type, relatedInstanceId, stageId, createdAt, updatedAt, [userId+createdAt]',
      pomoSessions: '++id, userId, taskId, mode, status, startedAt',
      replenishmentRecords: 'id, templateId, userId, scheduledDate, createdAt, [templateId+createdAt]',
      achievements: 'id, userId, status, createdAt, [userId+status]',
    });

    await legacy.open();
    await legacy.table('rewardTemplates').bulkAdd([
      {
        id: 't-old',
        userId: 1,
        title: '吃饭',
        pointsCost: 100,
        validDuration: 86400,
        enabled: true,
        replenishmentMode: 'none',
        icon: 'Pizza',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 't-new',
        userId: 1,
        title: '香烟',
        pointsCost: 20,
        pointsPerYuan: 2,
        validDuration: 0,
        enabled: true,
        replenishmentMode: 'none',
        icon: 'Cigarette',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await legacy.table('rewardInstances').add({
      id: 'i1',
      templateId: 't-old',
      userId: 1,
      status: 'available',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    legacy.close();

    // 2. 用当前 schema 打开，触发 v6 升级
    const db = getDB();
    await db.open();

    const tables = db.tables.map((table) => table.name);
    expect(tables).toContain('rewardPurchases');
    expect(tables).not.toContain('rewardInstances');

    // 3. 老模板补齐比例（1），已有比例不被覆盖；有效期字段被清除
    const oldTemplate = await db.rewardTemplates.get('t-old');
    expect(oldTemplate!.pointsPerYuan).toBe(1);
    expect('validDuration' in oldTemplate!).toBe(false);

    const newTemplate = await db.rewardTemplates.get('t-new');
    expect(newTemplate!.pointsPerYuan).toBe(2);
    expect('validDuration' in newTemplate!).toBe(false);

    // 4. 新表可用
    await db.rewardPurchases.add({
      id: 'p1',
      userId: 1,
      templateId: 't-old',
      template: { templateId: 't-old', title: '吃饭', icon: 'Pizza', pointsCost: 100, pointsPerYuan: 1 },
      quantity: 1,
      pointsCost: 100,
      pointsSpent: 100,
      moneyAmount: 100,
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    expect(await db.rewardPurchases.count()).toBe(1);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '@/db';
import type { Achievement, RewardPurchase, RewardTemplate, TaskTemplate, User } from '@/db/types';
import {
  exportAllData,
  importData,
  validateImportData,
  type ExportData,
} from './exportImportService';

const db = getDB();

function user(): User {
  return {
    id: 1,
    name: 'User',
    totalPoints: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function achievement(id: string): Achievement {
  return {
    id,
    userId: 1,
    title: '测试成就',
    description: '描述',
    icon: 'Trophy',
    condition: { type: 'task_complete_count', target: 5 },
    rewardPoints: 40,
    status: 'active',
    source: 'preset',
    baseline: 2,
    progress: 1,
    promptVersion: 'v1',
    createdAt: '2026-05-01T00:00:00.000Z',
  };
}

/** 构造最小可用的 1.0 备份（无 achievements 字段） */
function legacyBackup(): ExportData {
  return {
    version: '1.0',
    exportedAt: '2026-05-01T00:00:00.000Z',
    appVersion: '0.1.0',
    data: {
      taskTemplates: [],
      taskInstances: [],
      rewardTemplates: [],
      // 旧备份没有消费记录表
      rewardPurchases: undefined as unknown as RewardPurchase[],
      replenishmentRecords: [],
      users: [user()],
      pointsHistory: [],
      // 故意不提供 achievements，模拟旧备份
      achievements: undefined as unknown as Achievement[],
    },
  };
}

/** 模拟旧备份里的模板：没有 sortOrder 字段 */
function legacyTemplate(id: string, createdAt: string): TaskTemplate {
  return {
    id,
    userId: 1,
    title: id,
    repeatMode: 'daily',
    endCondition: 'manual',
    enabled: true,
    subtasks: [],
    createdAt,
    completeRule: { type: 'simple', stages: [], completionPoints: 10 },
  } as unknown as TaskTemplate;
}

describe('exportImportService - achievements', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.taskTemplates.clear();
    await db.taskInstances.clear();
    await db.pointsHistory.clear();
    await db.rewardPurchases.clear();
    await db.replenishmentRecords.clear();
    await db.achievements.clear();
    await db.users.add(user());
  });

  it('导出包含成就，且不包含任何 API Key 字段', async () => {
    await db.achievements.add(achievement('a1'));

    const exported = await exportAllData();

    expect(exported.version).toBe('1.2');
    expect(exported.data.achievements).toHaveLength(1);
    expect(exported.data.achievements[0].title).toBe('测试成就');

    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('api_key');
  });

  it('导入旧备份（模板无 sortOrder）后按 createdAt 顺序补全 sortOrder', async () => {
    const legacy = legacyBackup();
    legacy.data.taskTemplates = [
      legacyTemplate('t-late', '2026-03-01T00:00:00.000Z'),
      legacyTemplate('t-early', '2026-01-01T00:00:00.000Z'),
      legacyTemplate('t-mid', '2026-02-01T00:00:00.000Z'),
    ];

    const result = await importData(legacy);
    expect(result.success).toBe(true);

    const restored = await db.taskTemplates.toArray();
    const byId = new Map(restored.map((t) => [t.id, t.sortOrder]));
    expect(byId.get('t-early')).toBe(0);
    expect(byId.get('t-mid')).toBe(1);
    expect(byId.get('t-late')).toBe(2);
  });

  it('导出后清空再导入，成就可完整还原', async () => {
    await db.achievements.add(achievement('a1'));
    const exported = await exportAllData();

    await db.achievements.clear();
    expect(await db.achievements.count()).toBe(0);

    const preview = validateImportData(exported);
    expect(preview.isValid).toBe(true);
    expect(preview.stats?.achievements).toBe(1);

    const result = await importData(exported);
    expect(result.success).toBe(true);
    expect(result.stats?.achievements).toBe(1);

    const restored = await db.achievements.get('a1');
    expect(restored?.title).toBe('测试成就');
    expect(restored?.baseline).toBe(2);
  });

  it('导入 1.0 旧备份（无 achievements 字段）不会报错', async () => {
    await db.achievements.add(achievement('a1'));

    const legacy = legacyBackup();
    const preview = validateImportData(legacy);
    expect(preview.isValid).toBe(true);
    expect(preview.stats?.achievements).toBe(0);

    const result = await importData(legacy);
    expect(result.success).toBe(true);
    expect(result.stats?.achievements).toBe(0);

    // 旧备份覆盖导入后，成就表被清空
    expect(await db.achievements.count()).toBe(0);
  });

  it('旧备份没有消费记录表时，消费记录计 0 且导入成功', async () => {
    const legacy = legacyBackup();
    const preview = validateImportData(legacy);
    expect(preview.isValid).toBe(true);
    expect(preview.stats?.rewardPurchases).toBe(0);

    const result = await importData(legacy);
    expect(result.success).toBe(true);
    expect(result.stats?.rewardPurchases).toBe(0);
    expect(await db.rewardPurchases.count()).toBe(0);
  });

  it('消费记录可导出并完整还原，旧模板缺少单件金额时按积分货币比例兜底', async () => {
    await db.rewardPurchases.add({
      id: 'p1',
      userId: 1,
      templateId: 't1',
      template: { templateId: 't1', title: '吃饭', icon: 'Pizza', pointsCost: 100, moneyCost: 100 },
      quantity: 2,
      pointsCost: 100,
      pointsSpent: 200,
      moneyAmount: 200,
      createdAt: '2026-09-01T00:00:00.000Z',
    });

    const exported = await exportAllData();
    expect(exported.data.rewardPurchases).toHaveLength(1);

    const preview = validateImportData(exported);
    expect(preview.stats?.rewardPurchases).toBe(1);

    await db.rewardPurchases.clear();
    await db.rewardTemplates.clear();
    // 模拟旧备份里的模板：没有 moneyCost，只有旧的 pointsPerYuan
    const exportedWithLegacyTemplate = {
      ...exported,
      data: {
        ...exported.data,
        rewardTemplates: [
          {
            id: 't1',
            userId: 1,
            title: '吃饭',
            pointsCost: 100,
            // 旧备份遗留的比例字段：金额 = pointsCost / pointsPerYuan = ¥50
            pointsPerYuan: 2,
            enabled: true,
            replenishmentMode: 'none' as const,
            icon: 'Pizza' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
          } as unknown as RewardTemplate,
        ],
      },
    };

    const result = await importData(exportedWithLegacyTemplate);
    expect(result.success).toBe(true);
    expect(result.stats?.rewardPurchases).toBe(1);
    expect(await db.rewardPurchases.count()).toBe(1);
    expect((await db.rewardTemplates.get('t1'))?.moneyCost).toBe(50);
  });
});

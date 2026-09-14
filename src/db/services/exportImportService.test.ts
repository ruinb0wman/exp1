import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '@/db';
import type { Achievement, User } from '@/db/types';
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
      rewardInstances: [],
      replenishmentRecords: [],
      users: [user()],
      pointsHistory: [],
      // 故意不提供 achievements，模拟旧备份
      achievements: undefined as unknown as Achievement[],
    },
  };
}

describe('exportImportService - achievements', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.taskTemplates.clear();
    await db.taskInstances.clear();
    await db.pointsHistory.clear();
    await db.rewardInstances.clear();
    await db.replenishmentRecords.clear();
    await db.achievements.clear();
    await db.users.add(user());
  });

  it('导出包含成就，且不包含任何 API Key 字段', async () => {
    await db.achievements.add(achievement('a1'));

    const exported = await exportAllData();

    expect(exported.version).toBe('1.1');
    expect(exported.data.achievements).toHaveLength(1);
    expect(exported.data.achievements[0].title).toBe('测试成就');

    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('api_key');
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
});

/**
 * 同步系统测试
 * 
 * 测试场景:
 * 1. 首次同步（空数据库 ↔ 有数据）
 * 2. 双向修改同步
 * 3. 冲突解决流程
 * 4. 同步中断恢复
 * 5. 大数据量同步性能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDB, setDeviceId } from '@/db';
import { generateUUID, deepEqual, computeChecksum } from '@/services/sync/utils';
import { compressData, decompressData } from '@/services/sync/compression';
import { threeWayMerge, applyConflictResolutions } from '@/services/sync/merge';
import { createSyncBackup, restoreFromBackup, cleanupBackup } from '@/services/sync/backup';
import { collectSyncData, applySyncData } from '@/services/sync/syncService';
import type { SyncData, SyncMetadata } from '@/services/sync';

// 测试数据生成器
function createTestUser(id: number, name: string) {
  return {
    id,
    name,
    points: 0,
    createdAt: new Date().toISOString(),
  };
}

function createTestTaskTemplate(id: number, title: string) {
  return {
    id,
    userId: 1,
    title,
    description: 'Test description',
    rewardPoints: 10,
    enabled: true,
    repeatMode: 'daily' as const,
    endCondition: 'manual' as const,
    subtasks: [],
    isRandomSubtask: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTestMetadata(table: string, localId: number, syncId: string): SyncMetadata {
  return {
    table: table as any,
    localId,
    syncId,
    version: 1,
    modifiedAt: new Date().toISOString(),
    modifiedBy: 'pc',
    checksum: computeChecksum({ id: localId }),
    isDeleted: false,
  };
}

// 清理数据库
async function clearDatabase() {
  const db = getDB();
  const tables = ['users', 'taskTemplates', 'taskInstances', 'rewardTemplates', 'rewardInstances', 'pointsHistory', 'syncMetadata'];
  for (const table of tables) {
    await db.table(table).clear();
  }
}

describe('同步系统测试', () => {
  beforeEach(async () => {
    setDeviceId('pc');
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('基础工具函数', () => {
    it('应该能生成有效的 UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('应该能正确计算校验和', () => {
      const obj1 = { id: 1, name: 'test' };
      const obj2 = { id: 1, name: 'test' };
      const obj3 = { id: 2, name: 'test' };

      expect(computeChecksum(obj1)).toBe(computeChecksum(obj2));
      expect(computeChecksum(obj1)).not.toBe(computeChecksum(obj3));
    });

    it('应该能正确比较对象', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });
  });

  describe('压缩解压', () => {
    it('应该能正确压缩和解压数据', () => {
      const data = {
        users: [{ id: 1, name: 'Test' }],
        taskTemplates: [{ id: 1, title: 'Test Task' }],
      };

      const compressed = compressData(data);
      const decompressed = decompressData(compressed);

      expect(decompressed).toEqual(data);
    });

    it('应该能处理大数据量压缩', () => {
      const largeData = {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          points: i * 10,
        })),
      };

      const compressed = compressData(largeData);
      const decompressed = decompressData(compressed);

      expect(decompressed.users.length).toBe(1000);
      expect(decompressed.users[0].name).toBe('User 0');
    });
  });

  describe('三路合并算法', () => {
    it('应该能处理无冲突的情况（local === remote）', () => {
      const base = { id: 1, name: 'Base' };
      const local = { id: 1, name: 'Base' };
      const remote = { id: 1, name: 'Base' };

      const result = threeWayMerge(base, local, remote, 'users', 'test-uuid');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(local);
      expect(result.conflicts).toBeUndefined();
    });

    it('应该能处理 base === local 的情况（采用 remote）', () => {
      const base = { id: 1, name: 'Base' };
      const local = { id: 1, name: 'Base' };
      const remote = { id: 1, name: 'Remote Changed' };

      const result = threeWayMerge(base, local, remote, 'users', 'test-uuid');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Remote Changed');
    });

    it('应该能处理 base === remote 的情况（采用 local）', () => {
      const base = { id: 1, name: 'Base' };
      const local = { id: 1, name: 'Local Changed' };
      const remote = { id: 1, name: 'Base' };

      const result = threeWayMerge(base, local, remote, 'users', 'test-uuid');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Local Changed');
    });

    it('应该能检测字段级冲突', () => {
      const base = { id: 1, name: 'Base', points: 0 };
      const local = { id: 1, name: 'Local', points: 10 };
      const remote = { id: 1, name: 'Remote', points: 20 };

      const result = threeWayMerge(base, local, remote, 'users', 'test-uuid');

      expect(result.success).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts?.length).toBe(2); // name 和 points 都冲突
    });

    it('应该能应用冲突解决', () => {
      const base = { id: 1, name: 'Base', points: 0 };
      const local = { id: 1, name: 'Local', points: 10 };
      const remote = { id: 1, name: 'Remote', points: 20 };

      const resolutions = [
        { field: 'name', choice: 'local' as const },
        { field: 'points', choice: 'remote' as const },
      ];

      const result = applyConflictResolutions(base, local, remote, resolutions);

      expect(result.name).toBe('Local');
      expect(result.points).toBe(20);
    });
  });

  describe('备份恢复', () => {
    it('应该能创建和恢复备份', async () => {
      const db = getDB();
      const sessionId = 'test-session-1';

      // 添加测试数据
      await db.users.add(createTestUser(1, 'Test User'));
      await db.taskTemplates.add(createTestTaskTemplate(1, 'Test Task'));

      // 创建备份
      await createSyncBackup(sessionId);

      // 修改数据
      await db.users.update(1, { name: 'Modified User' });

      // 恢复备份
      await restoreFromBackup(sessionId);

      // 验证数据已恢复
      const user = await db.users.get(1);
      expect(user?.name).toBe('Test User');
    });

    it('应该能清理备份', async () => {
      const db = getDB();
      const sessionId = 'test-session-2';

      await db.users.add(createTestUser(1, 'Test User'));
      await createSyncBackup(sessionId);

      // 清理备份
      await cleanupBackup(sessionId);

      // 验证备份已清理
      const backups = await db.syncBackups.where('sessionId').equals(sessionId).toArray();
      expect(backups.length).toBe(0);
    });
  });

  describe('数据收集和应用', () => {
    it('应该能正确收集同步数据', async () => {
      const db = getDB();
      const sessionId = 'test-session-3';

      // 添加测试数据
      await db.users.add(createTestUser(1, 'Test User'));
      await db.taskTemplates.add(createTestTaskTemplate(1, 'Test Task'));

      // 收集数据
      const syncData = await collectSyncData(sessionId);

      expect(syncData.sessionId).toBe(sessionId);
      expect(syncData.deviceId).toBe('pc');
      expect(syncData.tables.users.records.length).toBe(1);
      expect(syncData.tables.taskTemplates.records.length).toBe(1);
    });

    it('应该能正确应用同步数据', async () => {
      const db = getDB();

      // 先添加一些数据
      await db.users.add(createTestUser(1, 'Old User'));

      // 准备同步数据
      const syncData: SyncData = {
        deviceId: 'mobile',
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        tables: {
          users: {
            metadata: [createTestMetadata('users', 1, 'uuid-1')],
            records: [createTestUser(1, 'New User')],
          },
          taskTemplates: {
            metadata: [],
            records: [],
          },
          taskInstances: {
            metadata: [],
            records: [],
          },
          rewardTemplates: {
            metadata: [],
            records: [],
          },
          rewardInstances: {
            metadata: [],
            records: [],
          },
          pointsHistory: {
            metadata: [],
            records: [],
          },
        },
      };

      // 应用数据
      await applySyncData(syncData);

      // 验证数据已更新
      const user = await db.users.get(1);
      expect(user?.name).toBe('New User');
    });
  });

  describe('首次同步', () => {
    it('应该能处理空数据库到非空数据库的同步', async () => {
      const db = getDB();

      // 准备源数据（模拟手机端数据）
      const sourceData: SyncData = {
        deviceId: 'mobile',
        sessionId: 'first-sync',
        timestamp: new Date().toISOString(),
        tables: {
          users: {
            metadata: [createTestMetadata('users', 1, 'uuid-1')],
            records: [createTestUser(1, 'Mobile User')],
          },
          taskTemplates: {
            metadata: [createTestMetadata('taskTemplates', 1, 'uuid-2')],
            records: [createTestTaskTemplate(1, 'Mobile Task')],
          },
          taskInstances: { metadata: [], records: [] },
          rewardTemplates: { metadata: [], records: [] },
          rewardInstances: { metadata: [], records: [] },
          pointsHistory: { metadata: [], records: [] },
        },
      };

      // 应用数据（模拟同步）
      await applySyncData(sourceData);

      // 验证数据已同步
      const users = await db.users.toArray();
      const tasks = await db.taskTemplates.toArray();

      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Mobile User');
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Mobile Task');
    });
  });

  describe('性能测试', () => {
    it('应该能在合理时间内处理大数据量', async () => {
      const db = getDB();
      const sessionId = 'perf-test';

      // 生成大量测试数据
      const userCount = 100;
      const taskCount = 500;

      for (let i = 1; i <= userCount; i++) {
        await db.users.add(createTestUser(i, `User ${i}`));
      }

      for (let i = 1; i <= taskCount; i++) {
        await db.taskTemplates.add(createTestTaskTemplate(i, `Task ${i}`));
      }

      // 测量收集时间
      const startTime = performance.now();
      const syncData = await collectSyncData(sessionId);
      const collectTime = performance.now() - startTime;

      // 测量压缩时间
      const compressStart = performance.now();
      const compressed = compressData(syncData);
      const compressTime = performance.now() - compressStart;

      // 测量解压时间
      const decompressStart = performance.now();
      const decompressed = decompressData(compressed);
      const decompressTime = performance.now() - decompressStart;

      // 测量应用时间
      const applyStart = performance.now();
      await applySyncData(decompressed);
      const applyTime = performance.now() - applyStart;

      console.log(`性能测试结果:`);
      console.log(`  数据收集: ${collectTime.toFixed(2)}ms`);
      console.log(`  压缩: ${compressTime.toFixed(2)}ms (${compressed.length} bytes)`);
      console.log(`  解压: ${decompressTime.toFixed(2)}ms`);
      console.log(`  应用: ${applyTime.toFixed(2)}ms`);

      // 验证性能要求（每个操作应该在 5 秒内完成）
      expect(collectTime).toBeLessThan(5000);
      expect(compressTime).toBeLessThan(5000);
      expect(decompressTime).toBeLessThan(5000);
      expect(applyTime).toBeLessThan(5000);
    });
  });
});

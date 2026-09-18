import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { getDB } from '../index';

/**
 * v9：执行等级
 *
 * 单独一个文件：`getDB()` 是单例，同文件内模拟两次「v8 → v9」拿不到真实升级路径。
 * vitest 按文件隔离模块，这里能拿到全新的 fake-indexeddb 与全新单例。
 *
 * 用 enabled: false 回避升级期间的实例生成检查（那条路径见 index.v9.middleware.test.ts）。
 */
const DB_NAME = 'exp-v7'; // 必须与运行时的库名一致才能触发真实升级路径

const V8_STORES = {
	taskTemplates: 'id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
	taskInstances:
		'id, userId, templateId, instanceDate, status, createdAt, updatedAt, [instanceDate+userId+status]',
	rewardTemplates: 'id, userId, replenishmentMode, enabled',
	users: 'id, name, updatedAt',
	pointsHistory:
		'id, userId, type, relatedInstanceId, stageId, createdAt, updatedAt, [userId+createdAt]',
	pomoSessions: '++id, userId, taskId, mode, status, startedAt',
	replenishmentRecords: 'id, templateId, userId, scheduledDate, createdAt, [templateId+createdAt]',
	achievements: 'id, userId, status, createdAt, [userId+status]',
	rewardPurchases: 'id, userId, templateId, createdAt, [userId+createdAt]',
};

/** v8 结构模板：有 sortOrder、没有 level */
function v8Template(id: string, userId: number, createdAt: string, sortOrder: number) {
	return {
		id,
		userId,
		title: id,
		repeatMode: 'daily',
		endCondition: 'manual',
		enabled: false,
		sortOrder,
		subtasks: [],
		createdAt,
	};
}

describe('migration v9 - 执行等级回填 + 清除 sortOrder', () => {
	it('旧模板统一 level=1，且旧 sortOrder 字段被删除', async () => {
		// 1. 以 v8 结构建库（用户升级前的状态：有 sortOrder，没有 level）
		const legacy = new Dexie(DB_NAME);
		legacy.version(8).stores(V8_STORES);
		await legacy.open();
		await legacy.table('taskTemplates').bulkAdd([
			v8Template('t-a', 1, '2026-01-01T00:00:00.000Z', 0),
			v8Template('t-b', 1, '2026-02-01T00:00:00.000Z', 1),
			v8Template('t-other-user', 2, '2026-03-01T00:00:00.000Z', 0),
		]);
		legacy.close();

		// 2. 用当前 schema 打开，触发 v9 升级
		const db = getDB();
		await db.open();

		for (const id of ['t-a', 't-b', 't-other-user']) {
			const template = await db.taskTemplates.get(id);
			expect(template!.level, `${id} 的 level`).toBe(1);
			expect('sortOrder' in (template as object), `${id} 仍带 sortOrder`).toBe(false);
		}

		// 3. 升级后结果稳定：再打开一次不改动数据
		const before = await db.taskTemplates.toArray();
		await db.close();
		await db.open();
		expect(await db.taskTemplates.toArray()).toEqual(before);
	});
});

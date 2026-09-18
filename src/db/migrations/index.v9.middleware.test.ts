import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { getDB } from '../index';
import { toUserDateString } from '@/libs/task';

/**
 * 升级期间会触发 taskTemplateMiddleware
 *
 * v8（模板顺序）与 v9（执行等级）都是通过 `bulkUpdate` 改模板的迁移，而 `bulkUpdate` 会为
 * **每个** enabled 模板注册一次 `trans.on('complete')` → `checkAndGenerateForTemplate`。
 *
 * 这里专门覆盖它：用 `enabled: true` 的模板 + 一条已存在的「今天」实例建 v7 库，
 * 再走真实升级路径（v8 → v9），断言「实例不丢 + 中间件照跑 + 幂等 + level 已回填」。
 *
 * 仍然是单独文件：`getDB()` 是单例，同文件内模拟两次 v7 → 最新版拿不到真实升级路径。
 */
const DB_NAME = 'exp-v7'; // 必须是同一个库名才能触发真实升级路径

const V7_STORES = {
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

/** 旧结构模板（无 level；enabled 为 true 以触发中间件） */
function legacyTemplate(id: string, createdAt: string) {
	return {
		id,
		userId: 1,
		title: id,
		repeatMode: 'daily' as const,
		repeatInterval: 1,
		// 注意：daily 分支要求 startAt 存在，否则 shouldGenerateInstanceOnDate 恒为 false，
		// 会让人误判成「中间件没跑」
		startAt: '2026-01-01',
		endCondition: 'manual' as const,
		enabled: true,
		subtasks: [],
		createdAt,
		completeRule: { type: 'simple' as const, stages: [], completionPoints: 5 },
	};
}

/** 轮询直到条件满足，避免用固定 sleep 造成偶发失败 */
async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 2000) {
	const deadline = Date.now() + timeoutMs;
	let value = await read();
	while (!done(value) && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 25));
		value = await read();
	}
	return value;
}

describe('migration v8/v9 - 升级期间的中间件行为（enabled 模板）', () => {
	it('保留已存在的今日实例，并为缺实例的 enabled 模板补生成且不重复', async () => {
		const legacy = new Dexie(DB_NAME);
		legacy.version(7).stores(V7_STORES);
		await legacy.open();

		const today = toUserDateString(new Date(), '00:00');

		await legacy.table('taskTemplates').bulkAdd([
			legacyTemplate('t-late', '2026-03-01T00:00:00.000Z'),
			legacyTemplate('t-early', '2026-01-01T00:00:00.000Z'),
		]);

		// t-early 升级前就已经有「今天」的实例 —— 升级后它必须还在
		await legacy.table('taskInstances').bulkAdd([
			{
				id: 'inst-t-early-today',
				userId: 1,
				templateId: 't-early',
				template: legacyTemplate('t-early', '2026-01-01T00:00:00.000Z'),
				status: 'pending',
				subtasks: [],
				instanceDate: today,
				createdAt: new Date().toISOString(),
				completedStages: [],
				stagePointsEarned: 0,
				completionPointsEarned: 0,
				completedSubtasks: [],
				isFullyCompleted: false,
			},
		]);
		await legacy.close();

		// 用当前 schema 打开 → 触发 v8/v9 升级（其 bulkUpdate 会触发中间件的 updating 钩子）
		const db = getDB();
		await db.open();

		// level 回填与中间件无关，先断言
		expect((await db.taskTemplates.get('t-early'))!.level).toBe(1);
		expect((await db.taskTemplates.get('t-late'))!.level).toBe(1);

		// 中间件的 trans.on('complete') 是异步 fire-and-forget，轮询等它落地
		const todayInstances = await waitFor(
			() => db.taskInstances.where('instanceDate').equals(today).toArray(),
			(list) => list.some((i) => i.templateId === 't-late')
		);

		// 1) 升级不丢已存在的今日实例
		expect(todayInstances.map((i) => i.id)).toContain('inst-t-early-today');
		// 2) 中间件确实在升级期间执行：t-late 今天原本没有实例 → 被补生成
		expect(todayInstances.map((i) => i.templateId)).toContain('t-late');
		// 3) 幂等：两个模板各只有一条今日实例
		expect(todayInstances.filter((i) => i.templateId === 't-early')).toHaveLength(1);
		expect(todayInstances.filter((i) => i.templateId === 't-late')).toHaveLength(1);
	});
});

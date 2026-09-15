import type { DB } from "../types";
import { generateUUID } from "@/libs/id";
import { toLocalDateString } from "@/libs/time";

export function migration(db: DB) {
	db.version(1).stores({
		taskTemplates: 'id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
		taskInstances: 'id, userId, templateId, instanceDate, status, createdAt, updatedAt, [instanceDate+userId+status]',
		rewardTemplates: 'id, userId, replenishmentMode, enabled',
		rewardInstances: 'id, templateId, userId, status, expiresAt, updatedAt',
		users: 'id, name, updatedAt',
		pointsHistory: 'id, userId, type, relatedInstanceId, stageId, createdAt, updatedAt, [userId+createdAt]',
		pomoSessions: '++id, userId, taskId, mode, status, startedAt',
	});

	db.version(2).stores({
		replenishmentRecords: 'id, templateId, userId, createdAt, [templateId+createdAt]',
	}).upgrade(async (trans) => {
		const d = trans.db as DB;
		const templates = await d.rewardTemplates.toArray();
		const now = new Date().toISOString();
		const records = templates
			.filter(t => t.replenishmentMode !== 'none' && t.currentStock !== undefined && t.currentStock > 0)
			.map(t => ({
				id: generateUUID(),
				templateId: t.id,
				userId: t.userId,
				quantity: t.currentStock ?? 0,
				stockBefore: 0,
				stockAfter: t.currentStock ?? 0,
				reason: 'auto' as const,
				scheduledDate: t.lastReplenishedDate || now.split('T')[0],
				createdAt: t.lastReplenishedDate ? `${t.lastReplenishedDate}T00:00:00.000Z` : now,
			}));
		if (records.length > 0) {
			await d.replenishmentRecords.bulkAdd(records);
		}
	});

	db.version(3).stores({
		replenishmentRecords: 'id, templateId, userId, scheduledDate, createdAt, [templateId+createdAt]',
	}).upgrade(async (trans) => {
		const d = trans.db as DB;
		const records = await d.replenishmentRecords.toArray();
		const updates = records
			.filter(r => !r.scheduledDate)
			.map(r => ({
				key: r.id,
				changes: { scheduledDate: r.createdAt.split('T')[0] },
			}));
		if (updates.length > 0) {
			await d.replenishmentRecords.bulkUpdate(updates);
		}
	});

	// v4：统一日历日存储 —— 把旧的"本地午夜 UTC ISO" startAt / 日期型 endValue 迁移为本地日期串 YYYY-MM-DD
	db.version(4).upgrade(async (trans) => {
		const d = trans.db as DB;
		const templates = await d.taskTemplates.toArray();
		const hasT = (s?: string) => !!s && s.includes('T');
		const updates = templates
			.filter(t => hasT(t.startAt) || (t.endCondition === 'date' && hasT(t.endValue)))
			.map(t => {
				const changes: { startAt?: string; endValue?: string } = {};
				if (hasT(t.startAt)) {
					changes.startAt = toLocalDateString(t.startAt!);
				}
				if (t.endCondition === 'date' && hasT(t.endValue)) {
					changes.endValue = toLocalDateString(t.endValue!);
				}
				return { key: t.id, changes };
			});
		if (updates.length > 0) {
			await d.taskTemplates.bulkUpdate(updates);
		}
	});

	// v5：成就系统
	db.version(5).stores({
		achievements: 'id, userId, status, createdAt, [userId+status]',
	});

	// v6：购买即消费 —— 删除背包实例表，新增消费记录表；清理有效期字段，补齐积分货币比例
	db.version(6).stores({
		rewardInstances: null,
		rewardPurchases: 'id, userId, templateId, createdAt, [userId+createdAt]',
	}).upgrade(async (trans) => {
		const d = trans.db as DB;
		const templates = await d.rewardTemplates.toArray();
		const updates = templates.map((t) => ({
			key: t.id,
			changes: {
				// Dexie：显式 undefined 会删除该字段
				validDuration: undefined,
				pointsPerYuan: t.pointsPerYuan ?? 1,
			},
		}));
		if (updates.length > 0) {
			await d.rewardTemplates.bulkUpdate(updates);
		}
	});
}

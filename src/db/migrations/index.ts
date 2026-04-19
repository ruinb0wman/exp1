import type { DB } from "../types";
import { generateUUID } from "@/libs/id";

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
}

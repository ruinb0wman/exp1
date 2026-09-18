import type { DB } from "../types";
import { generateUUID } from "@/libs/id";
import { toLocalDateString } from "@/libs/time";
import { roundMoney } from "@/libs/reward";

/** v7 之前模板上的积分货币比例（旧模型：金额 = pointsCost / pointsPerYuan） */
type LegacyRatioField = { pointsPerYuan?: number };

/** 取旧数据上可用的比例，非法值兜底为 1 */
function readLegacyRatio(template: unknown): number {
	const { pointsPerYuan } = template as LegacyRatioField;
	return Number.isFinite(pointsPerYuan) && (pointsPerYuan as number) > 0
		? (pointsPerYuan as number)
		: 1;
}

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
				pointsPerYuan: readLegacyRatio(t),
			},
		}));
		if (updates.length > 0) {
			await d.rewardTemplates.bulkUpdate(updates);
		}
	});

	// v7：金额与积分解耦 —— 用「单件金额」取代积分货币比例
	// 旧模型金额 = pointsCost / pointsPerYuan，迁移时按该式逐条等值换算；
	// 旧消费记录不动（moneyAmount 早已冻结在每条记录里）
	db.version(7).upgrade(async (trans) => {
		const d = trans.db as DB;
		const templates = await d.rewardTemplates.toArray();
		const updates = templates.map((t) => ({
			key: t.id,
			changes: {
				moneyCost: roundMoney(t.pointsCost / readLegacyRatio(t)),
				// Dexie：显式 undefined 会删除该字段
				pointsPerYuan: undefined,
			},
		}));
		if (updates.length > 0) {
			await d.rewardTemplates.bulkUpdate(updates);
		}
	});

	// v8：模板自定义显示顺序 —— 按「现有 sortOrder → createdAt → id」为每个用户回填 0..n-1
	// 注意：该字段已被 v9 删除，本块只为「v7 及更早的库」保留历史上的升级路径，
	// 因此排序逻辑冻结在这里，不随业务排序（现在按 level）变化。
	db.version(8).upgrade(async (trans) => {
		const d = trans.db as DB;
		const updates = computeLegacySortOrderUpdates(await d.taskTemplates.toArray());
		if (updates.length > 0) {
			await d.taskTemplates.bulkUpdate(
				updates.map(({ id, sortOrder }) => ({ key: id, changes: { sortOrder } }))
			);
		}
	});

	// v9：执行等级 —— 旧模板统一 level=1（保持原 createdAt 相对顺序不变），并清掉废弃的 sortOrder 列
	db.version(9).upgrade(async (trans) => {
		const d = trans.db as DB;
		const templates = await d.taskTemplates.toArray();
		const updates = templates.map((t) => {
			const legacyLevel = (t as { level?: number }).level;
			const level =
				Number.isFinite(legacyLevel) && (legacyLevel as number) > 0
					? (legacyLevel as number)
					: 1;
			// Dexie：显式 undefined 会删除该字段
			return { key: t.id, changes: { level, sortOrder: undefined } };
		});
		if (updates.length > 0) {
			await d.taskTemplates.bulkUpdate(updates);
		}
	});
}

/** v8 之前的模板顺序字段（已废弃；仅 v8 迁移用于回填） */
type LegacySortOrderTemplate = {
	id: string;
	userId: number;
	createdAt?: string;
	sortOrder?: number;
};

function resolveLegacySortOrder(template: LegacySortOrderTemplate): number {
	return typeof template.sortOrder === 'number' && Number.isFinite(template.sortOrder)
		? template.sortOrder
		: Number.MAX_SAFE_INTEGER;
}

/**
 * 计算每个用户模板在 v8 时应有的 sortOrder（按「现有 sortOrder → createdAt → id」排序后重编号 0..n-1）
 *
 * 历史逻辑，已被 v9 取代，不要再被新代码复用。
 */
function computeLegacySortOrderUpdates(
	templates: LegacySortOrderTemplate[]
): Array<{ id: string; sortOrder: number }> {
	const byUser = new Map<number, LegacySortOrderTemplate[]>();
	for (const template of templates) {
		const list = byUser.get(template.userId);
		if (list) list.push(template);
		else byUser.set(template.userId, [template]);
	}

	const updates: Array<{ id: string; sortOrder: number }> = [];
	for (const list of byUser.values()) {
		list
			.sort((a, b) => {
				const byOrder = resolveLegacySortOrder(a) - resolveLegacySortOrder(b);
				if (byOrder !== 0) return byOrder;

				const byCreatedAt = (a.createdAt || '').localeCompare(b.createdAt || '');
				if (byCreatedAt !== 0) return byCreatedAt;

				return String(a.id).localeCompare(String(b.id));
			})
			.forEach((template, index) => {
				if (template.sortOrder !== index) {
					updates.push({ id: template.id, sortOrder: index });
				}
			});
	}
	return updates;
}

import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '@/db';
import type {
	PointsHistory,
	PomoSession,
	TaskInstance,
	TaskTemplate,
	User,
} from '@/db/types';
import {
	generateReport,
	generateReportFilename,
	loadReportSources,
	renderReportJson,
} from './reportService';

const db = getDB();

/** 固定参照时刻：2026-03-30 12:00（本地） */
const NOW = new Date(2026, 2, 30, 12, 0, 0, 0);

function localISO(year: number, month: number, day: number, hour = 0, minute = 0): string {
	return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function makeTemplate(userId: number, id: string, createdAt: string): TaskTemplate {
	return {
		id,
		userId,
		title: `任务 ${id}`,
		repeatMode: 'daily',
		endCondition: 'manual',
		enabled: true,
		level: 1,
		subtasks: [],
		createdAt,
		completeExpireDays: 1,
		completeRule: { type: 'simple', stages: [], completionPoints: 10 },
	};
}

function makeInstance(params: {
	userId: number;
	id: string;
	template: TaskTemplate;
	instanceDate: string;
	completedAt?: string;
}): TaskInstance {
	return {
		id: params.id,
		userId: params.userId,
		templateId: params.template.id,
		template: params.template,
		status: params.completedAt ? 'completed' : 'pending',
		subtasks: [],
		instanceDate: params.instanceDate,
		createdAt: localISO(2026, 3, 1),
		completedAt: params.completedAt,
	};
}

function makeSession(params: {
	userId: number;
	taskId?: string;
	startedAt: string;
	mode?: PomoSession['mode'];
}): PomoSession {
	return {
		userId: params.userId,
		taskId: params.taskId,
		mode: params.mode ?? 'focus',
		duration: 1500,
		actualDuration: 1500,
		status: 'completed',
		startedAt: params.startedAt,
		interruptions: 0,
	};
}

function makePoints(params: {
	userId: number;
	id: string;
	amount: number;
	createdAt: string;
	relatedInstanceId?: string;
}): PointsHistory {
	return {
		id: params.id,
		userId: params.userId,
		amount: params.amount,
		type: 'task_completion',
		relatedInstanceId: params.relatedInstanceId,
		createdAt: params.createdAt,
	};
}

async function seed(): Promise<void> {
	const user1: User = {
		id: 1,
		name: 'User One',
		totalPoints: 0,
		createdAt: localISO(2026, 1, 1),
		dayEndTime: '00:00',
	};
	const user2: User = {
		id: 2,
		name: 'User Two',
		totalPoints: 0,
		createdAt: localISO(2026, 1, 1),
		dayEndTime: '00:00',
	};
	await db.users.bulkAdd([user1, user2]);

	const t1 = makeTemplate(1, 't1', localISO(2026, 3, 16, 8, 0));
	const t2 = makeTemplate(2, 't2', localISO(2026, 3, 16, 8, 0));
	await db.taskTemplates.bulkAdd([t1, t2]);

	await db.taskInstances.bulkAdd([
		makeInstance({
			userId: 1,
			id: 'a1',
			template: t1,
			instanceDate: '2026-03-16',
			completedAt: localISO(2026, 3, 16, 10, 0),
		}),
		makeInstance({
			userId: 1,
			id: 'a2',
			template: t1,
			instanceDate: '2026-03-17',
		}),
		// 其它用户的数据
		makeInstance({
			userId: 2,
			id: 'x1',
			template: t2,
			instanceDate: '2026-03-16',
			completedAt: localISO(2026, 3, 16, 10, 0),
		}),
		// 区间外
		makeInstance({
			userId: 1,
			id: 'old1',
			template: t1,
			instanceDate: '2026-02-01',
			completedAt: localISO(2026, 2, 1, 10, 0),
		}),
	]);

	await db.pomoSessions.bulkAdd([
		makeSession({ userId: 1, taskId: 'a1', startedAt: localISO(2026, 3, 16, 10, 5) }),
		makeSession({ userId: 1, taskId: 'a1', startedAt: localISO(2026, 2, 1, 10, 5) }),
		makeSession({ userId: 2, startedAt: localISO(2026, 3, 16, 10, 5) }),
	]);

	await db.pointsHistory.bulkAdd([
		makePoints({
			userId: 1,
			id: 'p1',
			amount: 10,
			createdAt: localISO(2026, 3, 16, 10, 0),
			relatedInstanceId: 'a1',
		}),
		makePoints({
			userId: 1,
			id: 'p2',
			amount: 10,
			createdAt: localISO(2026, 2, 1, 10, 0),
			relatedInstanceId: 'old1',
		}),
		makePoints({ userId: 2, id: 'p3', amount: 99, createdAt: localISO(2026, 3, 16, 10, 0) }),
	]);
}

describe('reportService', () => {
	beforeEach(async () => {
		await Promise.all([
			db.users.clear(),
			db.taskTemplates.clear(),
			db.taskInstances.clear(),
			db.pointsHistory.clear(),
			db.rewardPurchases.clear(),
			db.pomoSessions.clear(),
			db.achievements.clear(),
		]);
		await seed();
	});

	it('按用户隔离加载原始数据', async () => {
		const sources = await loadReportSources(1);
		expect(sources.user.id).toBe(1);
		expect(sources.instances.map((item) => item.id).sort()).toEqual(['a1', 'a2', 'old1']);
		expect(sources.sessions).toHaveLength(2);
		expect(sources.pointsRecords.map((item) => item.id).sort()).toEqual(['p1', 'p2']);
		expect(sources.templates.map((item) => item.id)).toEqual(['t1']);
	});

	it('未找到用户时抛出错误', async () => {
		await expect(loadReportSources(999)).rejects.toThrow('未找到用户数据');
	});

	it('端到端生成周报且只统计本期数据', async () => {
		const report = await generateReport({
			userId: 1,
			scope: 'week',
			anchor: '2026-03-18',
			now: NOW,
		});

		expect(report.period.start).toBe('2026-03-16');
		expect(report.period.end).toBe('2026-03-22');
		expect(report.period.isPartial).toBe(false);
		expect(report.metrics.plannedCount).toBe(2);
		expect(report.metrics.completedCount).toBe(1);
		expect(report.metrics.pointsEarned).toBe(10);
		expect(report.metrics.pomoFocusMinutes).toBe(25);
		expect(report.previousPeriod.start).toBe('2026-03-09');
		expect(report.granularity).toBe('day');
		expect(report.templates.map((item) => item.templateId)).toEqual(['t1']);
		expect(report.extras.templatesCreated).toBe(1);
		expect(report.user.name).toBe('User One');
		expect(report.dayEndTime).toBe('00:00');
	});

	it('自定义区间同样可用', async () => {
		const report = await generateReport({
			userId: 1,
			scope: 'custom',
			anchor: '2026-03-18',
			customStart: '2026-03-01',
			customEnd: '2026-03-16',
			now: NOW,
		});
		expect(report.period.start).toBe('2026-03-01');
		expect(report.period.end).toBe('2026-03-16');
		expect(report.metrics.plannedCount).toBe(1);
	});

	it('生成稳定的导出文件名', async () => {
		const report = await generateReport({
			userId: 1,
			scope: 'week',
			anchor: '2026-03-18',
			now: NOW,
		});
		expect(generateReportFilename(report, 'md')).toBe(
			'exp1-report-week-2026-03-16_2026-03-22.md'
		);
		expect(generateReportFilename(report, 'json')).toBe(
			'exp1-report-week-2026-03-16_2026-03-22.json'
		);
	});

	it('导出的 JSON 可被解析且保留英文 key', async () => {
		const report = await generateReport({
			userId: 1,
			scope: 'week',
			anchor: '2026-03-18',
			now: NOW,
		});
		const parsed = JSON.parse(renderReportJson(report));
		expect(parsed.formatVersion).toBe(1);
		expect(parsed.metrics.completedCount).toBe(1);
		expect(parsed.period.label).toBe('2026-W12');
		expect(Array.isArray(parsed.trend)).toBe(true);
	});
});

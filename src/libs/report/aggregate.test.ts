import { describe, expect, it } from 'vitest';
import type {
	Achievement,
	PointsHistory,
	PomoSession,
	RewardPurchase,
	TaskInstance,
	TaskStatus,
	TaskTemplate,
	User,
} from '@/db/types';
import { aggregateReport } from './aggregate';
import { resolvePeriod, resolvePreviousPeriod } from './period';
import type { ReportSources } from './types';

/** 固定参照时刻：2026-03-30 12:00（本地） */
const NOW = new Date(2026, 2, 30, 12, 0, 0, 0);

function localISO(year: number, month: number, day: number, hour = 0, minute = 0): string {
	return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

const user: User = {
	id: 1,
	name: 'Tester',
	createdAt: localISO(2026, 1, 1),
	totalPoints: 0,
	dayEndTime: '00:00',
};

function makeTemplate(id: string, title: string, overrides: Partial<TaskTemplate> = {}): TaskTemplate {
	return {
		id,
		userId: 1,
		title,
		repeatMode: 'daily',
		endCondition: 'manual',
		enabled: true,
		subtasks: [],
		createdAt: localISO(2026, 1, 1),
		completeExpireDays: 1,
		completeRule: { type: 'simple', stages: [], completionPoints: 10 },
		...overrides,
	};
}

function makeInstance(params: {
	id: string;
	template: TaskTemplate;
	instanceDate: string;
	status: TaskStatus;
	completedAt?: string;
	dimensions?: Partial<TaskInstance>;
}): TaskInstance {
	return {
		id: params.id,
		userId: 1,
		templateId: params.template.id,
		template: params.template,
		status: params.status,
		subtasks: [],
		instanceDate: params.instanceDate,
		createdAt: localISO(2026, 3, 1),
		completedAt: params.completedAt,
		...params.dimensions,
	};
}

const t1 = makeTemplate('t1', '阅读');
const t2 = makeTemplate('t2', '运动', {
	completeRule: { type: 'count', stages: [], completionPoints: 20 },
});

/** 本周（2026-03-16 ~ 2026-03-22） */
const weekPeriod = resolvePeriod({
	scope: 'week',
	anchor: '2026-03-18',
	today: '2026-03-30',
});
const previousWeekPeriod = resolvePreviousPeriod(weekPeriod);

const instances: TaskInstance[] = [
	// 本期
	makeInstance({
		id: 'a1',
		template: t1,
		instanceDate: '2026-03-16',
		status: 'completed',
		completedAt: localISO(2026, 3, 16, 10, 0),
	}),
	makeInstance({
		id: 'a2',
		template: t1,
		instanceDate: '2026-03-17',
		status: 'completed',
		completedAt: localISO(2026, 3, 17, 21, 30),
	}),
	makeInstance({ id: 'a3', template: t1, instanceDate: '2026-03-18', status: 'skipped' }),
	makeInstance({ id: 'a4', template: t2, instanceDate: '2026-03-18', status: 'pending' }),
	makeInstance({ id: 'a5', template: t2, instanceDate: '2026-03-19', status: 'pending' }),
	makeInstance({
		id: 'a6',
		template: t1,
		instanceDate: '2026-03-20',
		status: 'completed',
		completedAt: localISO(2026, 3, 20, 9, 0),
	}),
	// 上期
	makeInstance({
		id: 'b1',
		template: t1,
		instanceDate: '2026-03-10',
		status: 'completed',
		completedAt: localISO(2026, 3, 10, 10, 0),
	}),
	makeInstance({ id: 'b2', template: t1, instanceDate: '2026-03-11', status: 'pending' }),
	makeInstance({
		id: 'b3',
		template: t2,
		instanceDate: '2026-03-12',
		status: 'completed',
		completedAt: localISO(2026, 3, 12, 8, 0),
	}),
	// 跨期补完：所属日期早于本期起点，完成时间落在本期
	makeInstance({
		id: 'c1',
		template: t1,
		instanceDate: '2026-03-01',
		status: 'completed',
		completedAt: localISO(2026, 3, 17, 12, 0),
	}),
	// 无日期任务
	makeInstance({
		id: 'd1',
		template: t1,
		instanceDate: '',
		status: 'completed',
		completedAt: localISO(2026, 3, 18, 12, 0),
	}),
];

const sessions: PomoSession[] = [
	{
		userId: 1,
		taskId: 'a1',
		mode: 'focus',
		duration: 1500,
		actualDuration: 1500,
		status: 'completed',
		startedAt: localISO(2026, 3, 16, 10, 5),
		interruptions: 0,
	},
	{
		userId: 1,
		taskId: 'a1',
		mode: 'focus',
		duration: 1500,
		actualDuration: 1490,
		status: 'completed',
		startedAt: localISO(2026, 3, 16, 14, 0),
		interruptions: 2,
	},
	{
		userId: 1,
		mode: 'shortBreak',
		duration: 300,
		actualDuration: 300,
		status: 'completed',
		startedAt: localISO(2026, 3, 16, 14, 30),
		interruptions: 0,
	},
	{
		userId: 1,
		taskId: 'a2',
		mode: 'focus',
		duration: 1500,
		actualDuration: 600,
		status: 'aborted',
		startedAt: localISO(2026, 3, 17, 9, 0),
		interruptions: 1,
	},
	{
		userId: 1,
		taskId: 'b1',
		mode: 'focus',
		duration: 1500,
		actualDuration: 1500,
		status: 'completed',
		startedAt: localISO(2026, 3, 10, 9, 0),
		interruptions: 0,
	},
];

const pointsRecords: PointsHistory[] = [
	{
		id: 'p1',
		userId: 1,
		amount: 25,
		type: 'task_stage',
		relatedInstanceId: 'a1',
		createdAt: localISO(2026, 3, 16, 10, 0),
	},
	{
		id: 'p2',
		userId: 1,
		amount: 10,
		type: 'task_completion',
		relatedInstanceId: 'a1',
		createdAt: localISO(2026, 3, 16, 10, 6),
	},
	{
		id: 'p3',
		userId: 1,
		amount: -50,
		type: 'reward_exchange',
		createdAt: localISO(2026, 3, 18, 9, 0),
	},
	{
		id: 'p4',
		userId: 1,
		amount: 5,
		type: 'achievement',
		createdAt: localISO(2026, 3, 20, 9, 0),
	},
	{
		id: 'p5',
		userId: 1,
		amount: 20,
		type: 'task_completion',
		relatedInstanceId: 'b1',
		createdAt: localISO(2026, 3, 10, 10, 0),
	},
];

const templates: TaskTemplate[] = [
	{ ...t1, createdAt: localISO(2026, 3, 16, 8, 0) },
	{ ...t2, createdAt: localISO(2026, 1, 1) },
];

const achievements: Achievement[] = [
	{
		id: 'ach1',
		userId: 1,
		title: '起步',
		description: '',
		icon: 'Trophy',
		condition: { type: 'task_complete_count', target: 1 },
		rewardPoints: 10,
		status: 'unlocked',
		progress: 1,
		baseline: 0,
		promptVersion: '1',
		createdAt: localISO(2026, 3, 1),
		unlockedAt: localISO(2026, 3, 18, 12, 0),
		source: 'preset',
	},
];

const rewardPurchases: RewardPurchase[] = [
	{
		id: 'r1',
		templateId: 'rt1',
		template: { templateId: 'rt1', title: '测试奖励', icon: 'Gift', pointsCost: 10, moneyCost: 10 },
		userId: 1,
		quantity: 1,
		pointsCost: 10,
		pointsSpent: 10,
		moneyAmount: 10,
		createdAt: localISO(2026, 3, 18, 9, 0),
	},
];

const sources: ReportSources = {
	instances,
	sessions,
	pointsRecords,
	rewardPurchases,
	achievements,
	templates,
	user,
};

function buildReport(period = weekPeriod) {
	return aggregateReport({
		period,
		previousPeriod: previousWeekPeriod,
		sources,
		dayEndTime: '00:00',
		appVersion: '0.1.0',
		now: NOW,
	});
}

describe('aggregateReport - 总览指标', () => {
	const report = buildReport();

	it('统计计划/完成/跳过/待办/逾期与完成率', () => {
		expect(report.metrics.plannedCount).toBe(6);
		expect(report.metrics.completedCount).toBe(3);
		expect(report.metrics.skippedCount).toBe(1);
		expect(report.metrics.pendingCount).toBe(2);
		expect(report.metrics.overdueCount).toBe(2);
		expect(report.metrics.completionRate).toBeCloseTo(0.5);
	});

	it('单独统计跨期补完与无日期任务完成', () => {
		expect(report.metrics.carriedOverCompletedCount).toBe(1);
		expect(report.metrics.noDateCompletedCount).toBe(1);
	});

	it('统计活跃天数与连续天数', () => {
		expect(report.metrics.activeDays).toBe(4); // 03-16 / 17 / 18 / 20
		expect(report.metrics.longestStreak).toBe(3); // 16-18
		expect(report.metrics.endStreak).toBe(0); // 03-21、03-22 均无完成
	});

	it('统计番茄与积分', () => {
		expect(report.metrics.pomoFocusMinutes).toBe(49); // 25 + floor(24.83)
		expect(report.metrics.pomoFocusSessions).toBe(2);
		expect(report.metrics.pomoBreakSessions).toBe(1);
		expect(report.metrics.pomoInterruptions).toBe(2);
		expect(report.metrics.pointsEarned).toBe(40);
		expect(report.metrics.pointsSpent).toBe(50);
		expect(report.metrics.pointsNet).toBe(-10);
	});

	it('提供上期对比数据', () => {
		expect(report.previousMetrics.plannedCount).toBe(3);
		expect(report.previousMetrics.completedCount).toBe(2);
		expect(report.previousMetrics.overdueCount).toBe(1);
		expect(report.previousMetrics.pomoFocusMinutes).toBe(25);
		expect(report.previousMetrics.pointsEarned).toBe(20);
	});

	it('生成数据驱动的说明项', () => {
		const codes = report.notes.map((note) => note.code);
		expect(codes).toContain('carriedOver');
		expect(codes).toContain('noDateTasks');
		expect(codes).not.toContain('noData');
		expect(codes).not.toContain('partialPeriod');
	});
});

describe('aggregateReport - 趋势', () => {
	const report = buildReport();

	it('周报按天粒度，逐日归因 instanceDate', () => {
		expect(report.granularity).toBe('day');
		expect(report.trend).toHaveLength(7);

		const first = report.trend[0];
		expect(first.key).toBe('2026-03-16');
		expect(first.planned).toBe(1);
		expect(first.completed).toBe(1);
		expect(first.focusMinutes).toBe(49);
		expect(first.pointsNet).toBe(35);

		const skippedDay = report.trend.find((bucket) => bucket.key === '2026-03-18');
		expect(skippedDay?.planned).toBe(2);
		expect(skippedDay?.skipped).toBe(1);
		expect(skippedDay?.pointsNet).toBe(-50);
	});

	it('趋势合计与总览一致', () => {
		const sum = (pick: (bucket: (typeof report.trend)[number]) => number) =>
			report.trend.reduce((total, bucket) => total + pick(bucket), 0);
		expect(sum((bucket) => bucket.planned)).toBe(report.metrics.plannedCount);
		expect(sum((bucket) => bucket.completed)).toBe(report.metrics.completedCount);
		expect(sum((bucket) => bucket.focusMinutes)).toBe(report.metrics.pomoFocusMinutes);
		expect(sum((bucket) => bucket.pointsNet)).toBe(report.metrics.pointsNet);
	});

	it('年报按周聚合', () => {
		const yearPeriod = resolvePeriod({
			scope: 'year',
			anchor: '2026-06-01',
			today: '2026-12-31',
		});
		const yearReport = aggregateReport({
			period: yearPeriod,
			previousPeriod: resolvePreviousPeriod(yearPeriod),
			sources,
			dayEndTime: '00:00',
			appVersion: '0.1.0',
			now: NOW,
		});
		expect(yearReport.granularity).toBe('week');
		expect(yearReport.trend).toHaveLength(53);
		const completed = yearReport.trend.reduce((sum, bucket) => sum + bucket.completed, 0);
		expect(completed).toBe(yearReport.metrics.completedCount);
	});
});

describe('aggregateReport - 任务明细与洞察', () => {
	const report = buildReport();

	it('按模板聚合计划/完成/跳过/逾期/积分/专注', () => {
		expect(report.templates).toHaveLength(2);

		const [first, second] = report.templates;
		expect(first.templateId).toBe('t1');
		expect(first.planned).toBe(4);
		expect(first.completed).toBe(3);
		expect(first.skipped).toBe(1);
		expect(first.overdue).toBe(0);
		expect(first.pointsEarned).toBe(35);
		expect(first.focusMinutes).toBe(49);
		expect(first.completionRate).toBeCloseTo(0.75);

		expect(second.templateId).toBe('t2');
		expect(second.planned).toBe(2);
		expect(second.overdue).toBe(2);
		expect(second.completionRate).toBe(0);
	});

	it('统计番茄模式与积分类型', () => {
		const focus = report.pomo.byMode.find((bucket) => bucket.mode === 'focus');
		expect(focus?.sessions).toBe(2);
		expect(focus?.minutes).toBe(49);

		const amounts = new Map(report.points.byType.map((item) => [item.type, item.amount]));
		expect(amounts.get('task_stage')).toBe(25);
		expect(amounts.get('reward_exchange')).toBe(-50);

		expect(report.points.topEarn.map((record) => record.id)).toEqual(['p1', 'p2', 'p4']);
		expect(report.points.topSpend.map((record) => record.id)).toEqual(['p3']);
	});

	it('产出习惯洞察', () => {
		expect(report.insights.bestWeekday).toEqual({ weekday: 2, completed: 2 });
		expect(report.insights.bestHour).toEqual({ hour: 12, completed: 2 });
		expect(report.insights.topTask?.templateId).toBe('t1');
		expect(report.insights.mostSkippedTask?.templateId).toBe('t1');
		expect(report.insights.chronicallyOverdue).toEqual([
			{ templateId: 't2', title: '运动', overdue: 2 },
		]);
		expect(report.insights.avgDailyCompleted).toBe(0.4);
	});

	it('统计其它数据', () => {
		expect(report.extras).toEqual({
			templatesCreated: 1,
			achievementsUnlocked: 1,
			rewardsRedeemed: 1,
		});
	});
});

describe('aggregateReport - 空数据与天界', () => {
	it('无任何数据时不产生 NaN 并且完成率为 null', () => {
		const emptySources: ReportSources = {
			...sources,
			instances: [],
			sessions: [],
			pointsRecords: [],
			rewardPurchases: [],
			achievements: [],
			templates: [],
		};
		const report = aggregateReport({
			period: weekPeriod,
			previousPeriod: previousWeekPeriod,
			sources: emptySources,
			dayEndTime: '00:00',
			appVersion: '0.1.0',
			now: NOW,
		});

		expect(report.metrics.completionRate).toBeNull();
		expect(report.metrics.plannedCount).toBe(0);
		expect(report.insights.topTask).toBeNull();
		expect(report.insights.bestHour).toBeNull();
		expect(report.insights.chronicallyOverdue).toEqual([]);
		expect(report.templates).toEqual([]);
		expect(report.notes.map((note) => note.code)).toContain('noData');
		expect(report.notes.map((note) => note.code)).toContain('noPreviousData');
	});

	it('dayEndTime 为 04:00 时凌晨完成的任务归属前一天', () => {
		const lateNight = makeInstance({
			id: 'n1',
			template: t1,
			instanceDate: '2026-03-16',
			status: 'completed',
			completedAt: localISO(2026, 3, 17, 1, 30),
		});
		const report = aggregateReport({
			period: weekPeriod,
			previousPeriod: previousWeekPeriod,
			sources: { ...sources, instances: [lateNight], sessions: [], pointsRecords: [] },
			dayEndTime: '04:00',
			appVersion: '0.1.0',
			now: NOW,
		});
		expect(report.metrics.activeDays).toBe(1);
		// 归属到 03-16（周一）
		expect(report.insights.bestWeekday).toEqual({ weekday: 1, completed: 1 });
	});

	it('被今天截断时给出 partialPeriod 说明', () => {
		const partial = resolvePeriod({
			scope: 'week',
			anchor: '2026-03-18',
			today: '2026-03-18',
		});
		const report = aggregateReport({
			period: partial,
			previousPeriod: resolvePreviousPeriod(partial),
			sources,
			dayEndTime: '00:00',
			appVersion: '0.1.0',
			now: NOW,
		});
		expect(report.notes.map((note) => note.code)).toContain('partialPeriod');
	});
});

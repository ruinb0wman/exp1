import type {
	PointsHistory,
	PointsHistoryType,
	PomoMode,
	TaskInstance,
} from '@/db/types';
import { calculateExpiredAtByInstanceDate, getUserWeekday, toUserDateString } from '@/libs/time';
import {
	enumerateUserDays,
	enumerateWeekBuckets,
	getPeriodTimeWindow,
} from './period';
import type {
	HabitInsights,
	MetricSet,
	PomoModeBucket,
	PointsTypeBucket,
	ReportModel,
	ReportNote,
	ReportPeriod,
	ReportSources,
	TemplateBucket,
	TrendBucket,
	TrendGranularity,
} from './types';

const POMO_MODES: PomoMode[] = ['focus', 'shortBreak', 'longBreak'];
const TOP_POINTS_RECORDS = 5;
const TOP_OVERDUE_TEMPLATES = 5;

interface PeriodAggregate {
	metrics: MetricSet;
	trend: TrendBucket[];
	templates: TemplateBucket[];
	pomo: { byMode: PomoModeBucket[] };
	points: {
		byType: PointsTypeBucket[];
		topEarn: PointsHistory[];
		topSpend: PointsHistory[];
	};
	insights: HabitInsights;
}

interface DayAgg {
	planned: number;
	completed: number;
	skipped: number;
	focusMinutes: number;
	pointsNet: number;
}

/** 实例是否属于该周期（按 instanceDate 判断） */
function isDateInPeriod(date: string | undefined, period: ReportPeriod): boolean {
	return !!date && date >= period.start && date <= period.end;
}

/** 待办实例是否已逾期（以报告生成时刻为参照，保证可复现） */
function isInstanceOverdue(
	instance: TaskInstance,
	dayEndTime: string,
	nowMs: number
): boolean {
	if (instance.status !== 'pending') return false;
	const expireDays = instance.template?.completeExpireDays;
	if (!expireDays || expireDays <= 0 || !instance.instanceDate) return false;
	const expiredAt = calculateExpiredAtByInstanceDate(
		instance.instanceDate,
		expireDays,
		dayEndTime
	);
	return new Date(expiredAt).getTime() < nowMs;
}

/** 番茄时长按单个 session 向下取整到分钟后再求和 */
function sessionMinutes(session: { actualDuration: number }): number {
	return Math.floor(session.actualDuration / 60);
}

/**
 * 计算单个周期内的全部聚合结果
 */
function computePeriodAggregate(args: {
	period: ReportPeriod;
	sources: ReportSources;
	dayEndTime: string;
	granularity: TrendGranularity;
	now: Date;
}): PeriodAggregate {
	const { period, sources, dayEndTime, granularity, now } = args;
	const nowMs = now.getTime();
	const { startISO, endExclusiveISO } = getPeriodTimeWindow(period, dayEndTime);

	const periodInstances = sources.instances.filter((instance) =>
		isDateInPeriod(instance.instanceDate, period)
	);

	// ===== 任务指标 =====
	let completedCount = 0;
	let pendingCount = 0;
	let skippedCount = 0;
	let overdueCount = 0;

	for (const instance of periodInstances) {
		if (instance.status === 'completed') {
			completedCount += 1;
		} else if (instance.status === 'skipped') {
			skippedCount += 1;
		} else {
			pendingCount += 1;
		}
		if (isInstanceOverdue(instance, dayEndTime, nowMs)) {
			overdueCount += 1;
		}
	}

	const plannedCount = periodInstances.length;

	// ===== 完成时间归因 =====
	const completionDays = new Set<string>();
	for (const instance of sources.instances) {
		if (instance.status === 'completed' && instance.completedAt) {
			completionDays.add(toUserDateString(instance.completedAt, dayEndTime));
		}
	}

	const periodDays = enumerateUserDays(period);
	const activeDays = periodDays.filter((day) => completionDays.has(day)).length;

	let longestStreak = 0;
	let running = 0;
	for (const day of periodDays) {
		if (completionDays.has(day)) {
			running += 1;
			longestStreak = Math.max(longestStreak, running);
		} else {
			running = 0;
		}
	}

	// 期末连续天数：从区间最后一天（当天无完成则回看前一天）向前连续有完成的天数
	let endStreak = 0;
	let cursor = period.end;
	if (!completionDays.has(cursor)) {
		cursor = periodDays.length > 1 ? periodDays[periodDays.length - 2] : '';
	}
	for (let i = periodDays.length - 1; i >= 0; i--) {
		const day = periodDays[i];
		if (day > cursor) continue;
		if (completionDays.has(day)) {
			endStreak += 1;
		} else {
			break;
		}
	}

	// 无日期实例的完成数 + 跨期补完数
	let noDateCompletedCount = 0;
	let carriedOverCompletedCount = 0;
	for (const instance of sources.instances) {
		if (instance.status !== 'completed' || !instance.completedAt) continue;
		const completedDay = toUserDateString(instance.completedAt, dayEndTime);
		if (!isDateInPeriod(completedDay, period)) continue;

		if (!instance.instanceDate) {
			noDateCompletedCount += 1;
		} else if (instance.instanceDate < period.start) {
			carriedOverCompletedCount += 1;
		}
	}

	// ===== 番茄钟 =====
	const periodSessions = sources.sessions.filter(
		(session) =>
			session.status === 'completed' &&
			session.startedAt >= startISO &&
			session.startedAt < endExclusiveISO
	);
	const focusSessions = periodSessions.filter((session) => session.mode === 'focus');
	const pomoFocusMinutes = focusSessions.reduce(
		(sum, session) => sum + sessionMinutes(session),
		0
	);

	const byMode: PomoModeBucket[] = POMO_MODES.map((mode) => {
		const sessions = periodSessions.filter((session) => session.mode === mode);
		return {
			mode,
			sessions: sessions.length,
			minutes: sessions.reduce((sum, session) => sum + sessionMinutes(session), 0),
			interruptions: sessions.reduce((sum, session) => sum + (session.interruptions ?? 0), 0),
		};
	});

	// ===== 积分 =====
	const periodPoints = sources.pointsRecords
		.filter(
			(record) => record.createdAt >= startISO && record.createdAt < endExclusiveISO
		)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

	let pointsEarned = 0;
	let pointsSpent = 0;
	const pointsByType = new Map<PointsHistoryType, PointsTypeBucket>();
	for (const record of periodPoints) {
		if (record.amount > 0) {
			pointsEarned += record.amount;
		} else if (record.amount < 0) {
			pointsSpent += -record.amount;
		}
		const bucket = pointsByType.get(record.type);
		if (bucket) {
			bucket.amount += record.amount;
			bucket.count += 1;
		} else {
			pointsByType.set(record.type, {
				type: record.type,
				amount: record.amount,
				count: 1,
			});
		}
	}

	const topEarn = periodPoints
		.filter((record) => record.amount > 0)
		.sort((a, b) => b.amount - a.amount)
		.slice(0, TOP_POINTS_RECORDS);
	const topSpend = periodPoints
		.filter((record) => record.amount < 0)
		.sort((a, b) => a.amount - b.amount)
		.slice(0, TOP_POINTS_RECORDS);

	// ===== 每日明细（趋势桶的原始数据）=====
	const dayMap = new Map<string, DayAgg>();
	for (const day of periodDays) {
		dayMap.set(day, {
			planned: 0,
			completed: 0,
			skipped: 0,
			focusMinutes: 0,
			pointsNet: 0,
		});
	}

	for (const instance of periodInstances) {
		const bucket = instance.instanceDate ? dayMap.get(instance.instanceDate) : undefined;
		if (!bucket) continue;
		bucket.planned += 1;
		if (instance.status === 'completed') bucket.completed += 1;
		else if (instance.status === 'skipped') bucket.skipped += 1;
	}

	for (const session of focusSessions) {
		const bucket = dayMap.get(toUserDateString(session.startedAt, dayEndTime));
		if (bucket) bucket.focusMinutes += sessionMinutes(session);
	}

	for (const record of periodPoints) {
		const bucket = dayMap.get(toUserDateString(record.createdAt, dayEndTime));
		if (bucket) bucket.pointsNet += record.amount;
	}

	// ===== 趋势 =====
	const trend: TrendBucket[] = [];
	if (granularity === 'day') {
		for (const day of periodDays) {
			const bucket = dayMap.get(day)!;
			trend.push({
				key: day,
				label: day,
				start: day,
				planned: bucket.planned,
				completed: bucket.completed,
				skipped: bucket.skipped,
				focusMinutes: bucket.focusMinutes,
				pointsNet: bucket.pointsNet,
			});
		}
	} else {
		for (const week of enumerateWeekBuckets(period)) {
			const bucket: TrendBucket = {
				key: week.start,
				label: week.label,
				start: week.start,
				planned: 0,
				completed: 0,
				skipped: 0,
				focusMinutes: 0,
				pointsNet: 0,
			};
			for (const [day, dayData] of dayMap) {
				if (day < week.start || day > week.end) continue;
				bucket.planned += dayData.planned;
				bucket.completed += dayData.completed;
				bucket.skipped += dayData.skipped;
				bucket.focusMinutes += dayData.focusMinutes;
				bucket.pointsNet += dayData.pointsNet;
			}
			trend.push(bucket);
		}
	}

	// ===== 按模板聚合 =====
	const instanceById = new Map(sources.instances.map((instance) => [instance.id, instance]));
	const templateBuckets = new Map<string, TemplateBucket>();

	const ensureTemplate = (
		templateId: string,
		title: string,
		type: TemplateBucket['type']
	): TemplateBucket => {
		const existing = templateBuckets.get(templateId);
		if (existing) return existing;
		const created: TemplateBucket = {
			templateId,
			title,
			type,
			planned: 0,
			completed: 0,
			skipped: 0,
			overdue: 0,
			completionRate: null,
			pointsEarned: 0,
			focusMinutes: 0,
		};
		templateBuckets.set(templateId, created);
		return created;
	};

	for (const instance of periodInstances) {
		const template = instance.template;
		if (!template) continue;
		const bucket = ensureTemplate(
			instance.templateId,
			template.title,
			template.completeRule?.type ?? 'simple'
		);
		bucket.planned += 1;
		if (instance.status === 'completed') bucket.completed += 1;
		else if (instance.status === 'skipped') bucket.skipped += 1;
		if (isInstanceOverdue(instance, dayEndTime, nowMs)) bucket.overdue += 1;
	}

	for (const session of focusSessions) {
		const instance = session.taskId ? instanceById.get(session.taskId) : undefined;
		if (!instance) continue;
		const bucket = ensureTemplate(
			instance.templateId,
			instance.template?.title ?? instance.templateId,
			instance.template?.completeRule?.type ?? 'simple'
		);
		bucket.focusMinutes += sessionMinutes(session);
	}

	for (const record of periodPoints) {
		const instance = record.relatedInstanceId
			? instanceById.get(record.relatedInstanceId)
			: undefined;
		if (!instance) continue;
		const bucket = ensureTemplate(
			instance.templateId,
			instance.template?.title ?? instance.templateId,
			instance.template?.completeRule?.type ?? 'simple'
		);
		bucket.pointsEarned += record.amount;
	}

	const templates = Array.from(templateBuckets.values());
	for (const bucket of templates) {
		bucket.completionRate = bucket.planned > 0 ? bucket.completed / bucket.planned : null;
	}
	templates.sort(
		(a, b) => b.completed - a.completed || b.planned - a.planned || a.title.localeCompare(b.title)
	);

	// ===== 习惯洞察 =====
	const weekdayCounts = new Map<number, number>();
	const hourCounts = new Map<number, number>();
	for (const instance of sources.instances) {
		if (instance.status !== 'completed' || !instance.completedAt) continue;
		const completedDay = toUserDateString(instance.completedAt, dayEndTime);
		if (!isDateInPeriod(completedDay, period)) continue;

		const weekday = getUserWeekday(completedDay);
		weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);

		const hour = new Date(instance.completedAt).getHours();
		hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
	}

	let bestWeekday: HabitInsights['bestWeekday'] = null;
	for (const [weekday, count] of weekdayCounts) {
		if (!bestWeekday || count > bestWeekday.completed) {
			bestWeekday = { weekday, completed: count };
		}
	}

	let bestHour: HabitInsights['bestHour'] = null;
	for (const [hour, count] of hourCounts) {
		if (!bestHour || count > bestHour.completed) {
			bestHour = { hour, completed: count };
		}
	}

	const topTaskBucket = templates.find((bucket) => bucket.completed > 0) ?? null;
	const mostSkippedBucket = [...templates]
		.filter((bucket) => bucket.skipped > 0)
		.sort((a, b) => b.skipped - a.skipped)[0] ?? null;
	const chronicallyOverdue = [...templates]
		.filter((bucket) => bucket.overdue > 0)
		.sort((a, b) => b.overdue - a.overdue)
		.slice(0, TOP_OVERDUE_TEMPLATES)
		.map((bucket) => ({
			templateId: bucket.templateId,
			title: bucket.title,
			overdue: bucket.overdue,
		}));

	const metrics: MetricSet = {
		plannedCount,
		completedCount,
		pendingCount,
		skippedCount,
		overdueCount,
		completionRate: plannedCount > 0 ? completedCount / plannedCount : null,
		noDateCompletedCount,
		carriedOverCompletedCount,
		pointsEarned,
		pointsSpent,
		pointsNet: pointsEarned - pointsSpent,
		pomoFocusMinutes,
		pomoFocusSessions: focusSessions.length,
		pomoBreakSessions: periodSessions.length - focusSessions.length,
		pomoInterruptions: periodSessions.reduce(
			(sum, session) => sum + (session.interruptions ?? 0),
			0
		),
		activeDays,
		longestStreak,
		endStreak,
	};

	return {
		metrics,
		trend,
		templates,
		pomo: { byMode },
		points: {
			byType: Array.from(pointsByType.values()).sort(
				(a, b) => Math.abs(b.amount) - Math.abs(a.amount)
			),
			topEarn,
			topSpend,
		},
		insights: {
			bestWeekday,
			bestHour,
			topTask: topTaskBucket
				? {
						templateId: topTaskBucket.templateId,
						title: topTaskBucket.title,
						completed: topTaskBucket.completed,
					}
				: null,
			mostSkippedTask: mostSkippedBucket
				? {
						templateId: mostSkippedBucket.templateId,
						title: mostSkippedBucket.title,
						skipped: mostSkippedBucket.skipped,
					}
				: null,
			chronicallyOverdue,
			avgDailyCompleted:
				periodDays.length > 0
					? Math.round((completedCount / periodDays.length) * 10) / 10
					: 0,
		},
	};
}

/** 其它统计（新建模板 / 成就解锁 / 奖励兑换） */
function computeExtras(
	period: ReportPeriod,
	sources: ReportSources,
	dayEndTime: string
): ReportModel['extras'] {
	const { startISO, endExclusiveISO } = getPeriodTimeWindow(period, dayEndTime);
	const inWindow = (iso?: string) => !!iso && iso >= startISO && iso < endExclusiveISO;

	return {
		templatesCreated: sources.templates.filter((template) => inWindow(template.createdAt))
			.length,
		achievementsUnlocked: sources.achievements.filter((achievement) =>
			inWindow(achievement.unlockedAt)
		).length,
		rewardsRedeemed: sources.rewardPurchases.filter((purchase) => inWindow(purchase.createdAt))
			.length,
	};
}

/** 生成数据驱动的提示项 */
function buildNotes(args: {
	period: ReportPeriod;
	metrics: MetricSet;
	previousMetrics: MetricSet;
}): ReportNote[] {
	const { period, metrics, previousMetrics } = args;
	const notes: ReportNote[] = [];

	if (
		metrics.plannedCount === 0 &&
		metrics.completedCount === 0 &&
		metrics.pomoFocusSessions === 0 &&
		metrics.pointsEarned === 0 &&
		metrics.pointsSpent === 0 &&
		metrics.noDateCompletedCount === 0
	) {
		notes.push({ code: 'noData' });
	}
	if (period.isPartial) {
		notes.push({ code: 'partialPeriod', params: { date: period.end } });
	}
	if (
		previousMetrics.plannedCount === 0 &&
		previousMetrics.completedCount === 0 &&
		previousMetrics.pomoFocusSessions === 0 &&
		previousMetrics.pointsEarned === 0 &&
		previousMetrics.pointsSpent === 0
	) {
		notes.push({ code: 'noPreviousData' });
	}
	if (metrics.carriedOverCompletedCount > 0) {
		notes.push({
			code: 'carriedOver',
			params: { count: metrics.carriedOverCompletedCount, start: period.start },
		});
	}
	if (metrics.noDateCompletedCount > 0) {
		notes.push({ code: 'noDateTasks', params: { count: metrics.noDateCompletedCount } });
	}

	return notes;
}

/**
 * 生成完整报告模型（纯函数，不访问数据库、不调用 LLM）
 */
export function aggregateReport(args: {
	period: ReportPeriod;
	previousPeriod: ReportPeriod;
	sources: ReportSources;
	dayEndTime: string;
	appVersion: string;
	now?: Date;
}): ReportModel {
	const { period, previousPeriod, sources, dayEndTime, appVersion, now = new Date() } = args;

	const granularity: TrendGranularity = period.scope === 'year' ? 'week' : 'day';

	const current = computePeriodAggregate({ period, sources, dayEndTime, granularity, now });
	const previous = computePeriodAggregate({
		period: previousPeriod,
		sources,
		dayEndTime,
		granularity: 'day',
		now,
	});

	const timeZone =
		typeof Intl !== 'undefined'
			? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown'
			: 'unknown';

	return {
		formatVersion: 1,
		generatedAt: now.toISOString(),
		appVersion,
		timeZone,
		user: { id: sources.user.id, name: sources.user.name },
		period,
		previousPeriod,
		previousMetrics: previous.metrics,
		dayEndTime,
		weekStartsOn: 1,
		granularity,
		metrics: current.metrics,
		trend: current.trend,
		templates: current.templates,
		pomo: current.pomo,
		points: current.points,
		insights: current.insights,
		extras: computeExtras(period, sources, dayEndTime),
		notes: buildNotes({
			period,
			metrics: current.metrics,
			previousMetrics: previous.metrics,
		}),
	};
}

import { getDB } from '../index';
import { aggregateReport } from '@/libs/report/aggregate';
import { resolvePeriod, resolvePreviousPeriod } from '@/libs/report/period';
import type {
	ReportModel,
	ReportScope,
	ReportSources,
} from '@/libs/report/types';
import { toUserDateString } from '@/libs/time';

/** 与 package.json / tauri.conf.json 保持一致 */
const APP_VERSION = '0.1.0';

/**
 * 一次性加载生成报告所需的全部原始数据（按用户隔离）
 * 数据量小，直接全量加载后在内存中按周期切片，避免多次往返 IndexedDB
 */
export async function loadReportSources(userId: number): Promise<ReportSources> {
	const db = getDB();

	const [instances, sessions, pointsRecords, rewardInstances, achievements, templates, user] =
		await Promise.all([
			db.taskInstances.where('userId').equals(userId).toArray(),
			db.pomoSessions.where('userId').equals(userId).toArray(),
			db.pointsHistory.where('userId').equals(userId).toArray(),
			db.rewardInstances.where('userId').equals(userId).toArray(),
			db.achievements.where('userId').equals(userId).toArray(),
			db.taskTemplates.where('userId').equals(userId).toArray(),
			db.users.get(userId),
		]);

	if (!user) {
		throw new Error('未找到用户数据');
	}

	return {
		instances,
		sessions,
		pointsRecords,
		rewardInstances,
		achievements,
		templates,
		user,
	};
}

/**
 * 生成指定周期的报告模型
 * anchor 为锚点用户日（周/月/年 都取该日期所在的周期）
 */
export async function generateReport(input: {
	userId: number;
	scope: ReportScope;
	anchor: string;
	customStart?: string;
	customEnd?: string;
	now?: Date;
}): Promise<ReportModel> {
	const sources = await loadReportSources(input.userId);
	const dayEndTime = sources.user.dayEndTime ?? '00:00';
	const now = input.now ?? new Date();
	const today = toUserDateString(now, dayEndTime);

	const period = resolvePeriod({
		scope: input.scope,
		anchor: input.anchor,
		customStart: input.customStart,
		customEnd: input.customEnd,
		today,
	});
	const previousPeriod = resolvePreviousPeriod(period);

	return aggregateReport({
		period,
		previousPeriod,
		sources,
		dayEndTime,
		appVersion: APP_VERSION,
		now,
	});
}

/**
 * 生成导出文件名，如 exp1-report-week-2026-03-16_2026-03-22.md
 */
export function generateReportFilename(model: ReportModel, format: 'md' | 'json'): string {
	const { scope, start, end } = model.period;
	return `exp1-report-${scope}-${start}_${end}.${format}`;
}

/**
 * 报告 JSON 快照（稳定英文 key，供后续 MCP / 脚本消费）
 */
export function renderReportJson(model: ReportModel): string {
	return JSON.stringify(model, null, 2);
}

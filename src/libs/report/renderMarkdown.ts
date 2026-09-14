import type { PointsHistory } from '@/db/types';
import { buildAnalysisPrompt, type ReportTranslate } from './prompt';
import type { MetricSet, ReportModel, ReportNote, TemplateBucket } from './types';

export interface RenderMarkdownOptions {
	/** 是否附加「分析提示词」段落，默认 true */
	includePrompt?: boolean;
}

/** 表格单元格转义：避免 | 和换行破坏表格结构 */
function cell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/** 完成率格式化 */
function formatRate(rate: number | null): string {
	if (rate === null || Number.isNaN(rate)) return '—';
	return `${Math.round(rate * 100)}%`;
}

/** 计数增减格式化 */
function formatDelta(current: number, previous: number, hasPrevious: boolean): string {
	if (!hasPrevious) return '—';
	const diff = current - previous;
	if (diff === 0) return '0';
	return diff > 0 ? `+${diff}` : `${diff}`;
}

/** 比率增减格式化（百分点） */
function formatRateDelta(
	current: number | null,
	previous: number | null,
	hasPrevious: boolean
): string {
	if (!hasPrevious || current === null || previous === null) return '—';
	const diff = Math.round((current - previous) * 100);
	if (diff === 0) return '0';
	return diff > 0 ? `+${diff}pp` : `${diff}pp`;
}

/** 判断上期是否有可比数据 */
function hasPreviousData(previous: MetricSet): boolean {
	return (
		previous.plannedCount > 0 ||
		previous.completedCount > 0 ||
		previous.pomoFocusSessions > 0 ||
		previous.pointsEarned > 0 ||
		previous.pointsSpent > 0
	);
}

/** 渲染提示项 */
function renderNote(note: ReportNote, t: ReportTranslate): string {
	const params = note.params ? { ...note.params } : undefined;
	return `- ${t(`reports.notes.${note.code}`, params)}`;
}

/** 渲染总览指标表 */
function renderOverview(model: ReportModel, t: ReportTranslate): string {
	const { metrics, previousMetrics } = model;
	const hasPrev = hasPreviousData(previousMetrics);

	const rows: [string, string, string, string][] = [
		[
			t('reports.metric.planned'),
			String(metrics.plannedCount),
			String(previousMetrics.plannedCount),
			formatDelta(metrics.plannedCount, previousMetrics.plannedCount, hasPrev),
		],
		[
			t('reports.metric.completed'),
			String(metrics.completedCount),
			String(previousMetrics.completedCount),
			formatDelta(metrics.completedCount, previousMetrics.completedCount, hasPrev),
		],
		[
			t('reports.metric.skipped'),
			String(metrics.skippedCount),
			String(previousMetrics.skippedCount),
			formatDelta(metrics.skippedCount, previousMetrics.skippedCount, hasPrev),
		],
		[
			t('reports.metric.pending'),
			String(metrics.pendingCount),
			String(previousMetrics.pendingCount),
			formatDelta(metrics.pendingCount, previousMetrics.pendingCount, hasPrev),
		],
		[
			t('reports.metric.overdue'),
			String(metrics.overdueCount),
			String(previousMetrics.overdueCount),
			formatDelta(metrics.overdueCount, previousMetrics.overdueCount, hasPrev),
		],
		[
			t('reports.metric.completionRate'),
			formatRate(metrics.completionRate),
			formatRate(previousMetrics.completionRate),
			formatRateDelta(metrics.completionRate, previousMetrics.completionRate, hasPrev),
		],
		[
			t('reports.metric.activeDays'),
			String(metrics.activeDays),
			String(previousMetrics.activeDays),
			formatDelta(metrics.activeDays, previousMetrics.activeDays, hasPrev),
		],
		[
			t('reports.metric.longestStreak'),
			String(metrics.longestStreak),
			String(previousMetrics.longestStreak),
			formatDelta(metrics.longestStreak, previousMetrics.longestStreak, hasPrev),
		],
		[
			t('reports.metric.endStreak'),
			String(metrics.endStreak),
			String(previousMetrics.endStreak),
			formatDelta(metrics.endStreak, previousMetrics.endStreak, hasPrev),
		],
		[
			t('reports.metric.focusMinutes'),
			String(metrics.pomoFocusMinutes),
			String(previousMetrics.pomoFocusMinutes),
			formatDelta(
				metrics.pomoFocusMinutes,
				previousMetrics.pomoFocusMinutes,
				hasPrev
			),
		],
		[
			t('reports.metric.focusSessions'),
			String(metrics.pomoFocusSessions),
			String(previousMetrics.pomoFocusSessions),
			formatDelta(
				metrics.pomoFocusSessions,
				previousMetrics.pomoFocusSessions,
				hasPrev
			),
		],
		[
			t('reports.metric.interruptions'),
			String(metrics.pomoInterruptions),
			String(previousMetrics.pomoInterruptions),
			formatDelta(
				metrics.pomoInterruptions,
				previousMetrics.pomoInterruptions,
				hasPrev
			),
		],
		[
			t('reports.metric.pointsEarned'),
			String(metrics.pointsEarned),
			String(previousMetrics.pointsEarned),
			formatDelta(metrics.pointsEarned, previousMetrics.pointsEarned, hasPrev),
		],
		[
			t('reports.metric.pointsSpent'),
			String(metrics.pointsSpent),
			String(previousMetrics.pointsSpent),
			formatDelta(metrics.pointsSpent, previousMetrics.pointsSpent, hasPrev),
		],
		[
			t('reports.metric.pointsNet'),
			String(metrics.pointsNet),
			String(previousMetrics.pointsNet),
			formatDelta(metrics.pointsNet, previousMetrics.pointsNet, hasPrev),
		],
		[
			t('reports.metric.carriedOver'),
			String(metrics.carriedOverCompletedCount),
			String(previousMetrics.carriedOverCompletedCount),
			formatDelta(
				metrics.carriedOverCompletedCount,
				previousMetrics.carriedOverCompletedCount,
				hasPrev
			),
		],
		[
			t('reports.metric.noDateCompleted'),
			String(metrics.noDateCompletedCount),
			String(previousMetrics.noDateCompletedCount),
			formatDelta(
				metrics.noDateCompletedCount,
				previousMetrics.noDateCompletedCount,
				hasPrev
			),
		],
	];

	const header = `| ${t('reports.col.metric')} | ${t('reports.col.current')} | ${t('reports.col.previous')} | ${t('reports.col.change')} |`;
	const divider = '| --- | ---: | ---: | ---: |';
	const body = rows.map((row) => `| ${cell(row[0])} | ${row[1]} | ${row[2]} | ${row[3]} |`);

	return [header, divider, ...body].join('\n');
}

/** 渲染趋势表 */
function renderTrend(model: ReportModel, t: ReportTranslate): string {
	if (model.trend.length === 0) return t('reports.empty');

	const header = `| ${t('reports.trend.col.bucket')} | ${t('reports.trend.col.planned')} | ${t('reports.trend.col.completed')} | ${t('reports.trend.col.skipped')} | ${t('reports.trend.col.completionRate')} | ${t('reports.trend.col.focusMinutes')} | ${t('reports.trend.col.pointsNet')} |`;
	const divider = '| --- | ---: | ---: | ---: | ---: | ---: | ---: |';
	const body = model.trend.map((bucket) => {
		const rate = bucket.planned > 0 ? bucket.completed / bucket.planned : null;
		return `| ${cell(bucket.label)} | ${bucket.planned} | ${bucket.completed} | ${bucket.skipped} | ${formatRate(rate)} | ${bucket.focusMinutes} | ${bucket.pointsNet} |`;
	});

	return [header, divider, ...body].join('\n');
}

/** 渲染任务明细表 */
function renderTemplates(model: ReportModel, t: ReportTranslate): string {
	if (model.templates.length === 0) return t('reports.empty');

	const header = `| ${t('reports.tasks.col.title')} | ${t('reports.tasks.col.type')} | ${t('reports.tasks.col.planned')} | ${t('reports.tasks.col.completed')} | ${t('reports.tasks.col.skipped')} | ${t('reports.tasks.col.overdue')} | ${t('reports.tasks.col.completionRate')} | ${t('reports.tasks.col.points')} | ${t('reports.tasks.col.focusMinutes')} |`;
	const divider = '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
	const body = model.templates.map((bucket: TemplateBucket) =>
		`| ${cell(bucket.title)} | ${cell(t(`reports.taskType.${bucket.type}`))} | ${bucket.planned} | ${bucket.completed} | ${bucket.skipped} | ${bucket.overdue} | ${formatRate(bucket.completionRate)} | ${bucket.pointsEarned} | ${bucket.focusMinutes} |`
	);

	return [header, divider, ...body].join('\n');
}

/** 渲染番茄钟小节 */
function renderPomo(model: ReportModel, t: ReportTranslate): string {
	const totalSessions = model.pomo.byMode.reduce((sum, bucket) => sum + bucket.sessions, 0);
	if (totalSessions === 0) return t('reports.empty');

	const header = `| ${t('reports.pomo.col.mode')} | ${t('reports.pomo.col.sessions')} | ${t('reports.pomo.col.minutes')} | ${t('reports.pomo.col.interruptions')} |`;
	const divider = '| --- | ---: | ---: | ---: |';
	const body = model.pomo.byMode.map(
		(bucket) =>
			`| ${cell(t(`reports.pomo.mode.${bucket.mode}`))} | ${bucket.sessions} | ${bucket.minutes} | ${bucket.interruptions} |`
	);

	return [header, divider, ...body].join('\n');
}

/** 渲染积分小节 */
function renderPoints(model: ReportModel, t: ReportTranslate): string {
	const { byType, topEarn, topSpend } = model.points;
	if (byType.length === 0) return t('reports.empty');

	const header = `| ${t('reports.points.col.type')} | ${t('reports.points.col.amount')} | ${t('reports.points.col.count')} |`;
	const divider = '| --- | ---: | ---: |';
	const rows = byType.map(
		(bucket) =>
			`| ${cell(t(`reports.points.type.${bucket.type}`))} | ${bucket.amount} | ${bucket.count} |`
	);

	const renderRecord = (record: PointsHistory): string =>
		`| ${record.createdAt.slice(0, 10)} | ${cell(t(`reports.points.type.${record.type}`))} | ${record.amount} | ${cell(record.description ?? '')} |`;

	const blocks = [[header, divider, ...rows].join('\n')];

	const recordHeader = `| ${t('reports.points.col.date')} | ${t('reports.points.col.type')} | ${t('reports.points.col.amount')} | ${t('reports.points.col.description')} |`;
	const recordDivider = '| --- | --- | ---: | --- |';

	if (topEarn.length > 0) {
		blocks.push(`### ${t('reports.points.topEarn')}`);
		blocks.push([recordHeader, recordDivider, ...topEarn.map(renderRecord)].join('\n'));
	}
	if (topSpend.length > 0) {
		blocks.push(`### ${t('reports.points.topSpend')}`);
		blocks.push([recordHeader, recordDivider, ...topSpend.map(renderRecord)].join('\n'));
	}

	return blocks.join('\n\n');
}

/** 渲染习惯洞察小节 */
function renderInsights(model: ReportModel, t: ReportTranslate): string {
	const { insights } = model;
	const lines: string[] = [];

	lines.push(
		`- ${t('reports.insights.bestWeekday')}: ${
			insights.bestWeekday
				? t('reports.insights.weekdayValue', {
						weekday: t(`reports.weekday.${insights.bestWeekday.weekday}`),
						count: insights.bestWeekday.completed,
					})
				: t('reports.insights.none')
		}`
	);
	lines.push(
		`- ${t('reports.insights.bestHour')}: ${
			insights.bestHour
				? t('reports.insights.hourValue', {
						hour: insights.bestHour.hour,
						count: insights.bestHour.completed,
					})
				: t('reports.insights.none')
		}`
	);
	lines.push(
		`- ${t('reports.insights.topTask')}: ${
			insights.topTask
				? t('reports.insights.taskValue', {
						title: insights.topTask.title,
						count: insights.topTask.completed,
					})
				: t('reports.insights.none')
		}`
	);
	lines.push(
		`- ${t('reports.insights.mostSkipped')}: ${
			insights.mostSkippedTask
				? t('reports.insights.skippedValue', {
						title: insights.mostSkippedTask.title,
						count: insights.mostSkippedTask.skipped,
					})
				: t('reports.insights.none')
		}`
	);
	lines.push(
		`- ${t('reports.insights.avgDailyCompleted')}: ${insights.avgDailyCompleted}`
	);

	lines.push('');
	lines.push(`### ${t('reports.insights.chronicallyOverdue')}`);
	lines.push('');
	if (insights.chronicallyOverdue.length === 0) {
		lines.push(t('reports.empty'));
	} else {
		for (const item of insights.chronicallyOverdue) {
			lines.push(
				`- ${t('reports.insights.taskValue', {
					title: item.title,
					count: item.overdue,
				})}`
			);
		}
	}

	return lines.join('\n');
}

/**
 * 把报告模型渲染为 Markdown（可直接投喂 LLM / 对照 Logseq 日志）
 */
export function renderReportMarkdown(
	model: ReportModel,
	t: ReportTranslate,
	options: RenderMarkdownOptions = {}
): string {
	const includePrompt = options.includePrompt !== false;
	const { period, previousPeriod } = model;

	const partialSuffix = period.isPartial
		? t('reports.meta.partialSuffix', { date: period.end })
		: '';
	const title = t('reports.title', {
		label: period.label,
		start: period.start,
		end: period.end,
	});

	const meta: string[] = [
		`> ${t('reports.meta.generatedAt')}: ${model.generatedAt}`,
		`> ${t('reports.meta.range')}: ${period.start} ~ ${period.end}${partialSuffix}`,
		`> ${t('reports.meta.previousRange')}: ${previousPeriod.start} ~ ${previousPeriod.end}`,
		`> ${t('reports.meta.dayEndTime')}: ${model.dayEndTime}`,
		`> ${t('reports.meta.timeZone')}: ${model.timeZone}`,
		`> ${t('reports.meta.appVersion')}: ${model.appVersion}`,
		`> ${t('reports.meta.user')}: ${cell(model.user.name)} (#${model.user.id})`,
	];

	const sections: string[] = [`# ${title}`, '', meta.join('\n'), ''];

	if (model.notes.length > 0) {
		sections.push(`### ${t('reports.notes.title')}`);
		sections.push('');
		sections.push(model.notes.map((note) => renderNote(note, t)).join('\n'));
		sections.push('');
	}

	// 口径说明
	sections.push(`## ${t('reports.caliber.title')}`);
	sections.push('');
	sections.push(
		[
			t('reports.caliber.item1', { dayEndTime: model.dayEndTime }),
			t('reports.caliber.item2'),
			t('reports.caliber.item3'),
			t('reports.caliber.item4'),
			t('reports.caliber.item5'),
			t('reports.caliber.item6'),
		]
			.map((line) => `- ${line}`)
			.join('\n')
	);
	sections.push('');

	sections.push(`## 1. ${t('reports.section.overview')}`);
	sections.push('');
	sections.push(renderOverview(model, t));
	sections.push('');

	sections.push(`## 2. ${t('reports.section.trend')}`);
	sections.push('');
	sections.push(renderTrend(model, t));
	sections.push('');

	sections.push(`## 3. ${t('reports.section.tasks')}`);
	sections.push('');
	sections.push(renderTemplates(model, t));
	sections.push('');

	sections.push(`## 4. ${t('reports.section.pomo')}`);
	sections.push('');
	sections.push(renderPomo(model, t));
	sections.push('');

	sections.push(`## 5. ${t('reports.section.points')}`);
	sections.push('');
	sections.push(renderPoints(model, t));
	sections.push('');

	sections.push(`## 6. ${t('reports.section.insights')}`);
	sections.push('');
	sections.push(renderInsights(model, t));
	sections.push('');

	sections.push(`## 7. ${t('reports.section.extras')}`);
	sections.push('');
	sections.push(
		[
			`- ${t('reports.extras.templatesCreated')}: ${model.extras.templatesCreated}`,
			`- ${t('reports.extras.achievementsUnlocked')}: ${model.extras.achievementsUnlocked}`,
			`- ${t('reports.extras.rewardsRedeemed')}: ${model.extras.rewardsRedeemed}`,
		].join('\n')
	);
	sections.push('');

	if (includePrompt) {
		sections.push(buildAnalysisPrompt(model, t));
		sections.push('');
	}

	return sections.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

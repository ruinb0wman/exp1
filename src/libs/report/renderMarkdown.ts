import type { PointsHistory, PointsHistoryType, TaskType } from '@/db/types';
import type { PomoMode } from '@/db/types';
import { buildAnalysisPrompt } from './prompt';
import type { MetricSet, ReportModel, ReportNote, TemplateBucket } from './types';

/** 枚举标签（原 i18n 的 reports.taskType / pomo.mode / points.type / weekday 系列） */
const TASK_TYPE_LABEL: Record<TaskType, string> = {
	simple: 'simple',
	time: 'timed',
	count: 'counted',
	subtask: 'subtask',
};

const POMO_MODE_LABEL: Record<PomoMode, string> = {
	focus: 'Focus',
	shortBreak: 'Short break',
	longBreak: 'Long break',
};

const POINTS_TYPE_LABEL: Record<PointsHistoryType, string> = {
	task_undo: 'Task undo',
	task_stage: 'Task stage',
	task_reward: 'Task completion',
	task_completion: 'Task completion',
	task_deduction: 'Task progress rollback',
	reward_exchange: 'Purchase',
	achievement: 'Achievement reward',
	admin_adjustment: 'Manual adjustment',
};

const WEEKDAY_LABEL: Record<number, string> = {
	0: 'Sunday',
	1: 'Monday',
	2: 'Tuesday',
	3: 'Wednesday',
	4: 'Thursday',
	5: 'Friday',
	6: 'Saturday',
};

/** 提示项文案 */
const NOTE_TEXT: Record<
	ReportNote['code'],
	(params: Record<string, string | number>) => string
> = {
	noData: () => 'No tasks, pomodoro sessions or points in this period.',
	partialPeriod: ({ date }) => `This period is still in progress; data is as of ${date}.`,
	noPreviousData: () =>
		'The previous period has no comparable data, so change columns show —.',
	carriedOver: ({ count, start }) =>
		`${count} task(s) were completed during this period but were scheduled before ${start} (carried over).`,
	noDateTasks: ({ count }) =>
		`${count} undated task(s) were completed in this period and are excluded from the completion-rate denominator.`,
};

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
/** 提示项文案（供渲染层与页面复用） */
export function noteText(note: ReportNote): string {
	return NOTE_TEXT[note.code](note.params ?? {});
}

function renderNote(note: ReportNote): string {
	return `- ${noteText(note)}`;
}

/** 渲染总览指标表 */
function renderOverview(model: ReportModel): string {
	const { metrics, previousMetrics } = model;
	const hasPrev = hasPreviousData(previousMetrics);

	const rows: [string, string, string, string][] = [
		[
			"Planned tasks",
			String(metrics.plannedCount),
			String(previousMetrics.plannedCount),
			formatDelta(metrics.plannedCount, previousMetrics.plannedCount, hasPrev),
		],
		[
			"Completed tasks",
			String(metrics.completedCount),
			String(previousMetrics.completedCount),
			formatDelta(metrics.completedCount, previousMetrics.completedCount, hasPrev),
		],
		[
			"Skipped tasks",
			String(metrics.skippedCount),
			String(previousMetrics.skippedCount),
			formatDelta(metrics.skippedCount, previousMetrics.skippedCount, hasPrev),
		],
		[
			"Pending tasks",
			String(metrics.pendingCount),
			String(previousMetrics.pendingCount),
			formatDelta(metrics.pendingCount, previousMetrics.pendingCount, hasPrev),
		],
		[
			"Overdue tasks",
			String(metrics.overdueCount),
			String(previousMetrics.overdueCount),
			formatDelta(metrics.overdueCount, previousMetrics.overdueCount, hasPrev),
		],
		[
			"Completion rate",
			formatRate(metrics.completionRate),
			formatRate(previousMetrics.completionRate),
			formatRateDelta(metrics.completionRate, previousMetrics.completionRate, hasPrev),
		],
		[
			"Active days",
			String(metrics.activeDays),
			String(previousMetrics.activeDays),
			formatDelta(metrics.activeDays, previousMetrics.activeDays, hasPrev),
		],
		[
			"Longest streak",
			String(metrics.longestStreak),
			String(previousMetrics.longestStreak),
			formatDelta(metrics.longestStreak, previousMetrics.longestStreak, hasPrev),
		],
		[
			"Streak at period end",
			String(metrics.endStreak),
			String(previousMetrics.endStreak),
			formatDelta(metrics.endStreak, previousMetrics.endStreak, hasPrev),
		],
		[
			"Focus minutes",
			String(metrics.pomoFocusMinutes),
			String(previousMetrics.pomoFocusMinutes),
			formatDelta(
				metrics.pomoFocusMinutes,
				previousMetrics.pomoFocusMinutes,
				hasPrev
			),
		],
		[
			"Focus sessions",
			String(metrics.pomoFocusSessions),
			String(previousMetrics.pomoFocusSessions),
			formatDelta(
				metrics.pomoFocusSessions,
				previousMetrics.pomoFocusSessions,
				hasPrev
			),
		],
		[
			"Interruptions",
			String(metrics.pomoInterruptions),
			String(previousMetrics.pomoInterruptions),
			formatDelta(
				metrics.pomoInterruptions,
				previousMetrics.pomoInterruptions,
				hasPrev
			),
		],
		[
			"Points earned",
			String(metrics.pointsEarned),
			String(previousMetrics.pointsEarned),
			formatDelta(metrics.pointsEarned, previousMetrics.pointsEarned, hasPrev),
		],
		[
			"Points spent",
			String(metrics.pointsSpent),
			String(previousMetrics.pointsSpent),
			formatDelta(metrics.pointsSpent, previousMetrics.pointsSpent, hasPrev),
		],
		[
			"Points net",
			String(metrics.pointsNet),
			String(previousMetrics.pointsNet),
			formatDelta(metrics.pointsNet, previousMetrics.pointsNet, hasPrev),
		],
		[
			"Carried over",
			String(metrics.carriedOverCompletedCount),
			String(previousMetrics.carriedOverCompletedCount),
			formatDelta(
				metrics.carriedOverCompletedCount,
				previousMetrics.carriedOverCompletedCount,
				hasPrev
			),
		],
		[
			"Undated completions",
			String(metrics.noDateCompletedCount),
			String(previousMetrics.noDateCompletedCount),
			formatDelta(
				metrics.noDateCompletedCount,
				previousMetrics.noDateCompletedCount,
				hasPrev
			),
		],
	];

	const header = `| Metric | Current | Previous | Change |`;
	const divider = '| --- | ---: | ---: | ---: |';
	const body = rows.map((row) => `| ${cell(row[0])} | ${row[1]} | ${row[2]} | ${row[3]} |`);

	return [header, divider, ...body].join('\n');
}

/** 渲染趋势表 */
function renderTrend(model: ReportModel): string {
	if (model.trend.length === 0) return "No data for this period";

	const header = `| Date | Planned | Completed | Skipped | Rate | Focus min | Points net |`;
	const divider = '| --- | ---: | ---: | ---: | ---: | ---: | ---: |';
	const body = model.trend.map((bucket) => {
		const rate = bucket.planned > 0 ? bucket.completed / bucket.planned : null;
		return `| ${cell(bucket.label)} | ${bucket.planned} | ${bucket.completed} | ${bucket.skipped} | ${formatRate(rate)} | ${bucket.focusMinutes} | ${bucket.pointsNet} |`;
	});

	return [header, divider, ...body].join('\n');
}

/** 渲染任务明细表 */
function renderTemplates(model: ReportModel): string {
	if (model.templates.length === 0) return "No data for this period";

	const header = `| Task | Type | Planned | Completed | Skipped | Overdue | Rate | Points | Focus min |`;
	const divider = '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
	const body = model.templates.map((bucket: TemplateBucket) =>
		`| ${cell(bucket.title)} | ${cell(TASK_TYPE_LABEL[bucket.type])} | ${bucket.planned} | ${bucket.completed} | ${bucket.skipped} | ${bucket.overdue} | ${formatRate(bucket.completionRate)} | ${bucket.pointsEarned} | ${bucket.focusMinutes} |`
	);

	return [header, divider, ...body].join('\n');
}

/** 渲染按等级小节 */
function renderLevels(model: ReportModel): string {
	if (model.levels.length === 0) return "No data for this period";

	const header = `| Level | Planned | Completed | Completion rate | Days with tasks | Cleared days | Survival rate |`;
	const divider = '| --- | ---: | ---: | ---: | ---: | ---: | ---: |';
	// 「L{level}」与列表页卡片上的徽标一致，不做本地化
	const body = model.levels.map(
		(bucket) =>
			`| L${bucket.level} | ${bucket.planned} | ${bucket.completed} | ${formatRate(bucket.completionRate)} | ${bucket.activeDays} | ${bucket.clearedDays} | ${formatRate(bucket.survivalRate)} |`
	);

	return [header, divider, ...body].join('\n');
}

/** 渲染番茄钟小节 */
function renderPomo(model: ReportModel): string {
	const totalSessions = model.pomo.byMode.reduce((sum, bucket) => sum + bucket.sessions, 0);
	if (totalSessions === 0) return "No data for this period";

	const header = `| Mode | Sessions | Minutes | Interruptions |`;
	const divider = '| --- | ---: | ---: | ---: |';
	const body = model.pomo.byMode.map(
		(bucket) =>
			`| ${cell(POMO_MODE_LABEL[bucket.mode])} | ${bucket.sessions} | ${bucket.minutes} | ${bucket.interruptions} |`
	);

	return [header, divider, ...body].join('\n');
}

/** 渲染积分小节 */
function renderPoints(model: ReportModel): string {
	const { byType, topEarn, topSpend } = model.points;
	if (byType.length === 0) return "No data for this period";

	const header = `| Type | Amount | Count |`;
	const divider = '| --- | ---: | ---: |';
	const rows = byType.map(
		(bucket) =>
			`| ${cell(POINTS_TYPE_LABEL[bucket.type])} | ${bucket.amount} | ${bucket.count} |`
	);

	const renderRecord = (record: PointsHistory): string =>
		`| ${record.createdAt.slice(0, 10)} | ${cell(POINTS_TYPE_LABEL[record.type])} | ${record.amount} | ${cell(record.description ?? '')} |`;

	const blocks = [[header, divider, ...rows].join('\n')];

	const recordHeader = `| Date | Type | Amount | Description |`;
	const recordDivider = '| --- | --- | ---: | --- |';

	if (topEarn.length > 0) {
		blocks.push(`### Top income`);
		blocks.push([recordHeader, recordDivider, ...topEarn.map(renderRecord)].join('\n'));
	}
	if (topSpend.length > 0) {
		blocks.push(`### Top spending`);
		blocks.push([recordHeader, recordDivider, ...topSpend.map(renderRecord)].join('\n'));
	}

	return blocks.join('\n\n');
}

/** 渲染习惯洞察小节 */
function renderInsights(model: ReportModel): string {
	const { insights } = model;
	const lines: string[] = [];

	lines.push(
		`- Most active weekday: ${
			insights.bestWeekday
				? `${WEEKDAY_LABEL[insights.bestWeekday.weekday]} (${insights.bestWeekday.completed} completions)`
				: "None"
		}`
	);
	lines.push(
		`- Most active hour: ${
			insights.bestHour
				? `${insights.bestHour.hour}:00 - ${insights.bestHour.hour}:59 (${insights.bestHour.completed} completions)`
				: "None"
		}`
	);
	lines.push(
		`- Most completed task: ${
			insights.topTask
				? `${insights.topTask.title} (${insights.topTask.completed} times)`
				: "None"
		}`
	);
	lines.push(
		`- Most skipped task: ${
			insights.mostSkippedTask
				? `${insights.mostSkippedTask.title} (skipped ${insights.mostSkippedTask.skipped} times)`
				: "None"
		}`
	);
	lines.push(
		`- Average per day: ${insights.avgDailyCompleted}`
	);

	lines.push('');
	lines.push(`### Chronically overdue`);
	lines.push('');
	if (insights.chronicallyOverdue.length === 0) {
		lines.push("No data for this period");
	} else {
		for (const item of insights.chronicallyOverdue) {
			lines.push(`- ${item.title} (${item.overdue} times)`);
		}
	}

	return lines.join('\n');
}

/**
 * 把报告模型渲染为 Markdown（可直接投喂 LLM / 对照 Logseq 日志）
 */
export function renderReportMarkdown(
	model: ReportModel,
	options: RenderMarkdownOptions = {}
): string {
	const includePrompt = options.includePrompt !== false;
	const { period, previousPeriod } = model;

	const partialSuffix = period.isPartial
		? ` (as of ${period.end})`
		: '';
	const title = `Task Review · ${period.label} (${period.start} ~ ${period.end})`;

	const meta: string[] = [
		`> Generated at: ${model.generatedAt}`,
		`> Range: ${period.start} ~ ${period.end}${partialSuffix}`,
		`> Previous range: ${previousPeriod.start} ~ ${previousPeriod.end}`,
		`> Day end time: ${model.dayEndTime}`,
		`> Time zone: ${model.timeZone}`,
		`> App version: ${model.appVersion}`,
		`> User: ${cell(model.user.name)} (#${model.user.id})`,
	];

	const sections: string[] = [`# ${title}`, '', meta.join('\n'), ''];

	if (model.notes.length > 0) {
		sections.push(`### Notes`);
		sections.push('');
		sections.push(model.notes.map((note) => renderNote(note)).join('\n'));
		sections.push('');
	}

	// 口径说明
	sections.push(`## Definitions`);
	sections.push('');
	sections.push(
		[
			`All dates are split by "user day": a day starts at your configured day end time (${model.dayEndTime}) and ends just before the same time the next day.`,
			"Planned = task instances generated within the period (completed / pending / skipped); completion rate = completed ÷ planned.",
			"Overdue = still pending within the period and past the template's configured expire days.",
			"Trend and completion rate are attributed by the task's scheduled date (instanceDate); streaks, active days and peak hours are attributed by actual completion time.",
			"Undated tasks are excluded from the completion-rate denominator; completions in this period whose scheduled date is earlier are counted as carried over.",
			"Focus minutes only count completed pomodoro sessions, floored to minutes per session; points income/spending are attributed by record creation time.",
			"By-level table: the level is the task's current level setting (changing it recomputes past reports too); completion rate = completed instances ÷ planned instances; cleared days = days where every planned instance of that level was completed (skips do not count), survival rate = cleared days ÷ days with tasks; instances without a date are excluded.",
		]
			.map((line) => `- ${line}`)
			.join('\n')
	);
	sections.push('');

	sections.push(`## 1. Overview`);
	sections.push('');
	sections.push(renderOverview(model));
	sections.push('');

	sections.push(`## 2. Trend`);
	sections.push('');
	sections.push(renderTrend(model));
	sections.push('');

	sections.push(`## 3. Task breakdown`);
	sections.push('');
	sections.push(renderTemplates(model));
	sections.push('');

	sections.push(`## 4. Pomodoro`);
	sections.push('');
	sections.push(renderPomo(model));
	sections.push('');

	sections.push(`## 5. Points`);
	sections.push('');
	sections.push(renderPoints(model));
	sections.push('');

	sections.push(`## 6. Habit insights`);
	sections.push('');
	sections.push(renderInsights(model));
	sections.push('');

	sections.push(`## 7. Extras`);
	sections.push('');
	sections.push(
		[
			`- Templates created: ${model.extras.templatesCreated}`,
			`- Achievements unlocked: ${model.extras.achievementsUnlocked}`,
			`- Purchases: ${model.extras.rewardsRedeemed}`,
		].join('\n')
	);
	sections.push('');

	// 追加在末尾（而不是插在趋势之后）：知识库里的年报模板按节号引用 1/2/4/6/7 节，
	// 追加不会打破那些引用。
	sections.push(`## 8. By level`);
	sections.push('');
	sections.push(renderLevels(model));
	sections.push('');

	if (includePrompt) {
		sections.push(buildAnalysisPrompt(model));
		sections.push('');
	}

	return sections.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

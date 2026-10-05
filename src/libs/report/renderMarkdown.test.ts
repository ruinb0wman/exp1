import { describe, expect, it } from 'vitest';
import { renderReportMarkdown } from './renderMarkdown';
import type { MetricSet, ReportModel, ReportPeriod } from './types';

const weekPeriod: ReportPeriod = {
	scope: 'week',
	start: '2026-03-16',
	end: '2026-03-22',
	label: '2026-W12',
	isPartial: false,
};

const previousPeriod: ReportPeriod = {
	scope: 'week',
	start: '2026-03-09',
	end: '2026-03-15',
	label: '2026-W11',
	isPartial: false,
};

function metrics(overrides: Partial<MetricSet> = {}): MetricSet {
	return {
		plannedCount: 0,
		completedCount: 0,
		pendingCount: 0,
		skippedCount: 0,
		overdueCount: 0,
		completionRate: null,
		noDateCompletedCount: 0,
		carriedOverCompletedCount: 0,
		pointsEarned: 0,
		pointsSpent: 0,
		pointsNet: 0,
		pomoFocusMinutes: 0,
		pomoFocusSessions: 0,
		pomoBreakSessions: 0,
		pomoInterruptions: 0,
		activeDays: 0,
		longestStreak: 0,
		endStreak: 0,
		...overrides,
	};
}

function makeModel(overrides: Partial<ReportModel> = {}): ReportModel {
	return {
		formatVersion: 1,
		generatedAt: '2026-03-23T02:00:00.000Z',
		appVersion: '0.1.0',
		timeZone: 'Asia/Shanghai',
		user: { id: 1, name: 'Tester' },
		period: weekPeriod,
		previousPeriod,
		previousMetrics: metrics(),
		dayEndTime: '00:00',
		weekStartsOn: 1,
		granularity: 'day',
		metrics: metrics(),
		trend: [],
		templates: [],
		levels: [],
		previousLevels: [],
		pomo: { byMode: [] },
		points: { byType: [], topEarn: [], topSpend: [] },
		insights: {
			bestWeekday: null,
			bestHour: null,
			topTask: null,
			mostSkippedTask: null,
			chronicallyOverdue: [],
			avgDailyCompleted: 0,
		},
		extras: { templatesCreated: 0, achievementsUnlocked: 0, rewardsRedeemed: 0 },
		notes: [],
		...overrides,
	};
}

// 任务标题是用户数据，保留中文以贴近真实数据（顺带覆盖表格转义）
const fullModel = makeModel({
	metrics: metrics({
		plannedCount: 6,
		completedCount: 3,
		pendingCount: 2,
		skippedCount: 1,
		overdueCount: 2,
		completionRate: 0.5,
		carriedOverCompletedCount: 1,
		noDateCompletedCount: 1,
		pointsEarned: 40,
		pointsSpent: 50,
		pointsNet: -10,
		pomoFocusMinutes: 49,
		pomoFocusSessions: 2,
		pomoBreakSessions: 1,
		pomoInterruptions: 2,
		activeDays: 4,
		longestStreak: 3,
		endStreak: 0,
	}),
	previousMetrics: metrics({ plannedCount: 3, completedCount: 2, completionRate: 2 / 3 }),
	trend: [
		{
			key: '2026-03-16',
			label: '2026-03-16',
			start: '2026-03-16',
			planned: 1,
			completed: 1,
			skipped: 0,
			focusMinutes: 49,
			pointsNet: 35,
		},
	],
	templates: [
		{
			templateId: 't1',
			title: '阅读 | 深度',
			type: 'simple',
			planned: 4,
			completed: 3,
			skipped: 1,
			overdue: 0,
			completionRate: 0.75,
			pointsEarned: 35,
			focusMinutes: 49,
		},
	],
	pomo: {
		byMode: [{ mode: 'focus', sessions: 2, minutes: 49, interruptions: 2 }],
	},
	levels: [
		{
			level: 1,
			planned: 4,
			completed: 3,
			skipped: 1,
			pending: 0,
			overdue: 0,
			completionRate: 0.75,
			activeDays: 4,
			clearedDays: 3,
			survivalRate: 0.75,
		},
		// 已配置但本期没有任务的等级：比率为 null
		{
			level: 3,
			planned: 0,
			completed: 0,
			skipped: 0,
			pending: 0,
			overdue: 0,
			completionRate: null,
			activeDays: 0,
			clearedDays: 0,
			survivalRate: null,
		},
	],
	previousLevels: [
		{
			level: 1,
			planned: 3,
			completed: 2,
			skipped: 0,
			pending: 1,
			overdue: 0,
			completionRate: 2 / 3,
			activeDays: 3,
			clearedDays: 2,
			survivalRate: 2 / 3,
		},
	],
	points: {
		byType: [{ type: 'task_stage', amount: 25, count: 1 }],
		topEarn: [
			{
				id: 'p1',
				userId: 1,
				amount: 25,
				type: 'task_stage',
				description: 'Stage completed',
				createdAt: '2026-03-16T02:00:00.000Z',
			},
		],
		topSpend: [],
	},
	insights: {
		bestWeekday: { weekday: 2, completed: 2 },
		bestHour: { hour: 12, completed: 2 },
		topTask: { templateId: 't1', title: '阅读', completed: 3 },
		mostSkippedTask: { templateId: 't1', title: '阅读', skipped: 1 },
		chronicallyOverdue: [{ templateId: 't2', title: '运动', overdue: 2 }],
		avgDailyCompleted: 0.4,
	},
	extras: { templatesCreated: 1, achievementsUnlocked: 1, rewardsRedeemed: 1 },
	notes: [
		{ code: 'carriedOver', params: { count: 1, start: '2026-03-16' } },
		{ code: 'noDateTasks', params: { count: 1 } },
	],
});

describe('renderReportMarkdown', () => {
	const markdown = renderReportMarkdown(fullModel);

	it('渲染标题与元信息', () => {
		expect(markdown).toContain('# Task Review · 2026-W12 (2026-03-16 ~ 2026-03-22)');
		expect(markdown).toContain('> Generated at: 2026-03-23T02:00:00.000Z');
		expect(markdown).toContain('> Range: 2026-03-16 ~ 2026-03-22');
		expect(markdown).toContain('> Time zone: Asia/Shanghai');
	});

	it('渲染全部小节', () => {
		expect(markdown).toContain('## 1. Overview');
		expect(markdown).toContain('## 2. Trend');
		expect(markdown).toContain('## 3. Task breakdown');
		expect(markdown).toContain('## 4. Pomodoro');
		expect(markdown).toContain('## 5. Points');
		expect(markdown).toContain('## 6. Habit insights');
		expect(markdown).toContain('## 7. Extras');
		// 按等级追加在末尾，1~7 节编号保持不变（知识库按节号引用这份报告）
		expect(markdown).toContain('## 8. By level');
		expect(markdown).toContain('## 9. Analysis prompt');
	});

	it('渲染按等级表（含本期无任务的等级）', () => {
		expect(markdown).toContain(
			'| Level | Planned | Completed | Completion rate | Days with tasks | Cleared days | Survival rate |'
		);
		expect(markdown).toContain('| L1 | 4 | 3 | 75% | 4 | 3 | 75% |');
		expect(markdown).toContain('| L3 | 0 | 0 | — | 0 | 0 | — |');
	});

	it('提示词要求对比等级差异', () => {
		expect(markdown).toContain('Compare completion and survival rates across levels');
	});

	it('渲染口径说明与数据说明', () => {
		expect(markdown).toContain('1 task(s) were completed during this period but were scheduled before 2026-03-16');
		expect(markdown).toContain('1 undated task(s) were completed in this period');
		expect(markdown).toContain('completion rate = completed ÷ planned');
		expect(markdown).toContain('day end time (00:00)');
	});

	it('渲染各枚举标签', () => {
		expect(markdown).toContain('| 阅读 \\| 深度 | simple |');
		expect(markdown).toContain('| Focus | 2 | 49 | 2 |');
		expect(markdown).toContain('| Task stage | 25 | 1 |');
		expect(markdown).toContain('- Most active weekday: Tuesday (2 completions)');
		expect(markdown).toContain('- Most active hour: 12:00 - 12:59 (2 completions)');
		expect(markdown).toContain('### Chronically overdue');
		expect(markdown).toContain('- 运动 (2 times)');
	});

	it('转义表格单元格中的竖线', () => {
		expect(markdown).toContain('阅读 \\| 深度');
	});

	it('所有表格行的列数一致', () => {
		const lines = markdown.split('\n');
		let block: number[] = [];
		let blockLines: string[] = [];
		const checkBlock = () => {
			if (block.length === 0) return;
			for (const pipes of block) {
				expect(pipes, JSON.stringify(blockLines)).toBe(block[0]);
			}
			block = [];
			blockLines = [];
		};

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith('|')) {
				block.push(trimmed.split(/(?<!\\)\|/).length);
				blockLines.push(trimmed);
			} else {
				checkBlock();
			}
		}
		checkBlock();
	});

	it('可以通过开关关闭分析提示词', () => {
		const withoutPrompt = renderReportMarkdown(fullModel, { includePrompt: false });
		expect(withoutPrompt).not.toContain('## 9. Analysis prompt');
		expect(withoutPrompt).toContain('## 8. By level');
		expect(withoutPrompt).toContain('## 7. Extras');
	});

	it('无数据时输出占位文案而不是空表', () => {
		const empty = renderReportMarkdown(makeModel());
		expect(empty).toContain('| Planned tasks | 0 | 0 | — |');
		expect(empty).toContain('No data for this period');
		expect(empty).toContain('- Most completed task: None');
	});

	it('兑换备注（含竖线与换行）写进积分描述时不会破坏表格', () => {
		// 备注是用户自由输入，可能带竖线/换行；积分描述会拼上备注
		const noted: ReportModel = {
			...fullModel,
			points: {
				...fullModel.points,
				topSpend: [
					{
						id: 'p-note',
						userId: 1,
						amount: -10,
						type: 'reward_exchange',
						description: 'Purchased 看电影 ×1 · 和朋友一起|周末\n第二行',
						createdAt: '2026-03-16T05:00:00.000Z',
					},
				],
			},
		};

		const rendered = renderReportMarkdown(noted);

		// 竖线转义、换行压成空格，整行仍是一条合法表格行
		expect(rendered).toContain('Purchased 看电影 ×1 · 和朋友一起\\|周末 第二行');
		expect(rendered).not.toContain('和朋友一起|周末');
	});

	it('提示词段引用了本期区间', () => {
		expect(markdown).toContain('Logseq journal for 2026-03-16 ~ 2026-03-22');
		expect(markdown).toContain('task report from the exp1 app for 2026-W12');
	});
});

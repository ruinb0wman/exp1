import { describe, expect, it } from 'vitest';
import zh from '@/locales/zh.json';
import en from '@/locales/en.json';
import { renderReportMarkdown } from './renderMarkdown';
import type { MetricSet, ReportModel, ReportPeriod } from './types';

type Dict = Record<string, unknown>;

function lookup(dict: Dict, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>(
			(acc, key) =>
				acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
			dict
		);
}

/** 轻量 t 实现：直接从语言包取字符串并做 {var} 插值 */
function makeT(dict: Dict) {
	return (key: string, options?: Record<string, unknown>): string => {
		const raw = lookup(dict, key);
		let text = typeof raw === 'string' ? raw : `MISSING:${key}`;
		if (options) {
			for (const [name, value] of Object.entries(options)) {
				text = text.split(`{${name}}`).join(String(value));
			}
		}
		return text;
	};
}

const t = makeT(zh as Dict);
const tEn = makeT(en as Dict);

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
	points: {
		byType: [{ type: 'task_stage', amount: 25, count: 1 }],
		topEarn: [
			{
				id: 'p1',
				userId: 1,
				amount: 25,
				type: 'task_stage',
				description: '阶段完成',
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
	const markdown = renderReportMarkdown(fullModel, t);

	it('渲染标题与元信息', () => {
		expect(markdown).toContain('# 任务分析报告 · 2026-W12（2026-03-16 ~ 2026-03-22）');
		expect(markdown).toContain('> 生成时间: 2026-03-23T02:00:00.000Z');
		expect(markdown).toContain('> 统计范围: 2026-03-16 ~ 2026-03-22');
		expect(markdown).toContain('> 时区: Asia/Shanghai');
	});

	it('渲染全部小节', () => {
		expect(markdown).toContain('## 1. 总览指标');
		expect(markdown).toContain('## 2. 趋势');
		expect(markdown).toContain('## 3. 任务明细');
		expect(markdown).toContain('## 4. 番茄钟');
		expect(markdown).toContain('## 5. 积分收支');
		expect(markdown).toContain('## 6. 习惯洞察');
		expect(markdown).toContain('## 7. 其他');
		expect(markdown).toContain('## 8. 分析提示词');
	});

	it('渲染口径说明与数据说明', () => {
		expect(markdown).toContain('- 有 1 个任务的完成时间落在本期');
		expect(markdown).toContain('完成率 = 完成数 ÷ 计划数');
		expect(markdown).toContain('一天结束时间（00:00）');
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
		const withoutPrompt = renderReportMarkdown(fullModel, t, { includePrompt: false });
		expect(withoutPrompt).not.toContain('## 8. 分析提示词');
		expect(withoutPrompt).toContain('## 7. 其他');
	});

	it('无数据时输出占位文案而不是空表', () => {
		const empty = renderReportMarkdown(makeModel(), t);
		expect(empty).toContain('| 计划任务数 | 0 | 0 | — |');
		expect(empty).toContain('本期无数据');
		expect(empty).toContain('- 最活跃任务: 无');
	});

	it('提示词段引用了本期区间', () => {
		expect(markdown).toContain('Logseq 中 2026-03-16 ~ 2026-03-22 的日志');
		expect(markdown).toContain('exp1 任务应用里 2026-W12');
	});

	it('可以完整渲染英文报告', () => {
		const english = renderReportMarkdown(fullModel, tEn);
		expect(english).toContain('# Task Review · 2026-W12 (2026-03-16 ~ 2026-03-22)');
		expect(english).toContain('## 1. Overview');
		expect(english).toContain('## 8. Analysis prompt');
	});
});

import type {
	Achievement,
	PointsHistory,
	PointsHistoryType,
	PomoMode,
	PomoSession,
	RewardInstance,
	TaskInstance,
	TaskTemplate,
	TaskType,
	User,
} from '@/db/types';

/** 报告周期类型 */
export type ReportScope = 'week' | 'month' | 'year' | 'custom';

/** 趋势粒度：周的粒度是「天」，年的粒度是「周」 */
export type TrendGranularity = 'day' | 'week';

/** 报告语言 */
export type ReportLocale = 'zh' | 'en';

/** 一个报告周期（全部使用用户日 YYYY-MM-DD） */
export interface ReportPeriod {
	scope: ReportScope;
	/** 起始用户日（含） */
	start: string;
	/** 结束用户日（含） */
	end: string;
	/** 展示标签，如 2026-W12 / 2026-03 / 2026 / 2026-03-01 ~ 2026-03-22 */
	label: string;
	/** 是否被「今天」截断（当期未结束） */
	isPartial: boolean;
}

/** 汇总指标 */
export interface MetricSet {
	plannedCount: number;
	completedCount: number;
	pendingCount: number;
	skippedCount: number;
	overdueCount: number;
	/** 完成率，分母为 0 时为 null */
	completionRate: number | null;
	/** 无日期实例在区间内的完成数（不计入完成率分母） */
	noDateCompletedCount: number;
	/** 完成时间落在区间内、但 instanceDate 早于区间起点的实例数 */
	carriedOverCompletedCount: number;
	pointsEarned: number;
	/** 支出（正数） */
	pointsSpent: number;
	pointsNet: number;
	pomoFocusMinutes: number;
	pomoFocusSessions: number;
	pomoBreakSessions: number;
	pomoInterruptions: number;
	activeDays: number;
	longestStreak: number;
	endStreak: number;
}

/** 趋势桶 */
export interface TrendBucket {
	/** 唯一键：天为 YYYY-MM-DD，周为周起始日 */
	key: string;
	/** 展示标签 */
	label: string;
	start: string;
	planned: number;
	completed: number;
	skipped: number;
	focusMinutes: number;
	pointsNet: number;
}

/** 按任务模板聚合 */
export interface TemplateBucket {
	templateId: string;
	title: string;
	type: TaskType;
	planned: number;
	completed: number;
	skipped: number;
	overdue: number;
	completionRate: number | null;
	pointsEarned: number;
	focusMinutes: number;
}

/** 番茄钟按模式聚合 */
export interface PomoModeBucket {
	mode: PomoMode;
	sessions: number;
	minutes: number;
	interruptions: number;
}

/** 积分按类型聚合 */
export interface PointsTypeBucket {
	type: PointsHistoryType;
	amount: number;
	count: number;
}

/** 习惯洞察 */
export interface HabitInsights {
	bestWeekday: { weekday: number; completed: number } | null;
	bestHour: { hour: number; completed: number } | null;
	topTask: { templateId: string; title: string; completed: number } | null;
	mostSkippedTask: { templateId: string; title: string; skipped: number } | null;
	chronicallyOverdue: { templateId: string; title: string; overdue: number }[];
	avgDailyCompleted: number;
}

/** 数据驱动的提示项（由渲染层翻译） */
export type ReportNoteCode =
	| 'noData'
	| 'partialPeriod'
	| 'noPreviousData'
	| 'carriedOver'
	| 'noDateTasks';

export interface ReportNote {
	code: ReportNoteCode;
	params?: Record<string, string | number>;
}

/** 报告模型（JSON 导出的结构，key 全英文、不依赖 i18n） */
export interface ReportModel {
	formatVersion: 1;
	generatedAt: string;
	appVersion: string;
	timeZone: string;
	user: { id: number; name: string };
	period: ReportPeriod;
	previousPeriod: ReportPeriod;
	previousMetrics: MetricSet;
	dayEndTime: string;
	weekStartsOn: 1;
	granularity: TrendGranularity;
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
	extras: {
		templatesCreated: number;
		achievementsUnlocked: number;
		rewardsRedeemed: number;
	};
	notes: ReportNote[];
}

/** 生成报告所需的原始数据（一次性加载，聚合时按周期切片） */
export interface ReportSources {
	/** 该用户全部任务实例（含内嵌 template 快照） */
	instances: TaskInstance[];
	sessions: PomoSession[];
	pointsRecords: PointsHistory[];
	rewardInstances: RewardInstance[];
	achievements: Achievement[];
	templates: TaskTemplate[];
	user: User;
}

import { isoWeekLabel } from '@/libs/report/period';
import type { ReportScope } from '@/libs/report/types';
import { formatLocalDate } from '@/libs/time';

export const REPORT_SCOPES: readonly ReportScope[] = ['week', 'month', 'year', 'custom'];

/** 比率格式化（完成率/存活率共用）：null → — */
export function formatRate(rate: number | null): string {
	if (rate === null) return '—';
	return `${Math.round(rate * 100)}%`;
}

/** 比率配色：>=80% 绿、>=50% 常规、其余 primary（任务明细表与按等级表共用） */
export function rateClass(rate: number | null): string {
	if (rate === null) return 'text-text-muted';
	if (rate >= 0.8) return 'text-emerald-400';
	if (rate >= 0.5) return 'text-text-primary';
	return 'text-primary';
}

/**
 * 锚点日期在当前周期下的展示标签（周报显示 ISO 周，月报显示年月，年报显示年份）
 */
export function formatAnchorLabel(scope: ReportScope, anchor: Date, fallback = ''): string {
	const dateStr = formatLocalDate(anchor);
	switch (scope) {
		case 'week':
			return isoWeekLabel(dateStr);
		case 'month':
			return dateStr.slice(0, 7);
		case 'year':
			return dateStr.slice(0, 4);
		case 'custom':
		default:
			return fallback;
	}
}

/**
 * 平移锚点日期：周 ±7 天，月/年取该月/年的第一天再平移
 */
export function shiftAnchor(scope: ReportScope, anchor: Date, delta: number): Date {
	switch (scope) {
		case 'week':
			return new Date(
				anchor.getFullYear(),
				anchor.getMonth(),
				anchor.getDate() + delta * 7,
				12
			);
		case 'month':
			return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1, 12);
		case 'year':
			return new Date(anchor.getFullYear() + delta, 0, 1, 12);
		case 'custom':
		default:
			return anchor;
	}
}

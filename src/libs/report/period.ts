import { addUserDays, daysBetweenLocal, getUserStartOfDay, getUserWeekday } from '@/libs/time';
import type { ReportPeriod, ReportScope } from './types';

export interface PeriodInput {
	scope: ReportScope;
	/** 锚点用户日 YYYY-MM-DD（周/月/年 都以该日期所在周期为准） */
	anchor: string;
	customStart?: string;
	customEnd?: string;
	/** 今天的用户日 YYYY-MM-DD，用于把区间右端截断到今天 */
	today: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 判断是否为合法的 YYYY-MM-DD */
function isValidUserDate(value?: string): value is string {
	return !!value && DATE_PATTERN.test(value);
}

/** 把用户日解析为本地正午的 Date（避免 DST 影响日界） */
export function parseUserDate(userDate: string): Date {
	const [year, month, day] = userDate.split('-').map(Number);
	return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * 计算某一个自然周的周一（用户日）
 */
export function getMondayOfWeek(userDate: string): string {
	const weekday = getUserWeekday(userDate);
	// 0=周日 → 回退 6 天；1=周一 → 回退 0 天
	const offset = (weekday + 6) % 7;
	return addUserDays(userDate, -offset);
}

/**
 * ISO 周标签，如 2026-W12
 * 跨年周按 ISO 规则归属到正确的年份（2026-01-01 → 2025-W53）
 */
export function isoWeekLabel(userDate: string): string {
	const [year, month, day] = userDate.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	// 移动到本周的周四
	const dayNum = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - dayNum + 3);

	const isoYear = date.getUTCFullYear();
	const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
	const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
	firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);

	const week =
		1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
	return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** 某个月的最后一天（用户日） */
function getMonthEnd(year: number, month1Based: number): string {
	const lastDay = new Date(year, month1Based, 0).getDate();
	return `${year}-${String(month1Based).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * 解析周期：
 * - 周：周一到周日（ISO 周）
 * - 月：自然月；年：自然年
 * - 自定义：起止用户日
 * 区间右端会被 today 截断，截断时 isPartial = true
 */
export function resolvePeriod(input: PeriodInput): ReportPeriod {
	const { scope, anchor, today } = input;
	const anchorDate = isValidUserDate(anchor) ? anchor : today;

	let start: string;
	let end: string;
	let label: string;
	let nominalEnd: string;

	switch (scope) {
		case 'week': {
			start = getMondayOfWeek(anchorDate);
			nominalEnd = addUserDays(start, 6);
			label = isoWeekLabel(start);
			break;
		}
		case 'month': {
			const [year, month] = anchorDate.split('-').map(Number);
			start = `${year}-${String(month).padStart(2, '0')}-01`;
			nominalEnd = getMonthEnd(year, month);
			label = `${year}-${String(month).padStart(2, '0')}`;
			break;
		}
		case 'year': {
			const [year] = anchorDate.split('-').map(Number);
			start = `${year}-01-01`;
			nominalEnd = `${year}-12-31`;
			label = `${year}`;
			break;
		}
		case 'custom':
		default: {
			const customStart = isValidUserDate(input.customStart) ? input.customStart : today;
			const customEnd = isValidUserDate(input.customEnd) ? input.customEnd : customStart;
			start = customStart <= customEnd ? customStart : customEnd;
			nominalEnd = customStart <= customEnd ? customEnd : customStart;
			label = `${start} ~ ${nominalEnd}`;
			break;
		}
	}

	end = nominalEnd;
	let isPartial = false;
	if (end > today) {
		end = today;
		isPartial = true;
	}
	// 极端情况：自定义区间整体在未来
	if (start > end) {
		end = start;
		isPartial = true;
	}

	return { scope, start, end, label, isPartial };
}

/**
 * 推算上一个同口径周期（自定义区间取紧邻的等长前段）
 */
export function resolvePreviousPeriod(period: ReportPeriod): ReportPeriod {
	switch (period.scope) {
		case 'week': {
			const start = addUserDays(period.start, -7);
			const end = addUserDays(period.end, -7);
			return { scope: 'week', start, end, label: isoWeekLabel(start), isPartial: false };
		}
		case 'month': {
			const [year, month] = period.start.split('-').map(Number);
			const prevMonth = month === 1 ? 12 : month - 1;
			const prevYear = month === 1 ? year - 1 : year;
			const label = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
			return {
				scope: 'month',
				start: `${label}-01`,
				end: getMonthEnd(prevYear, prevMonth),
				label,
				isPartial: false,
			};
		}
		case 'year': {
			const year = Number(period.start.split('-')[0]) - 1;
			return {
				scope: 'year',
				start: `${year}-01-01`,
				end: `${year}-12-31`,
				label: `${year}`,
				isPartial: false,
			};
		}
		case 'custom':
		default: {
			const length = daysBetweenLocal(period.start, period.end) + 1;
			const end = addUserDays(period.start, -1);
			const start = addUserDays(end, -(length - 1));
			return {
				scope: 'custom',
				start,
				end,
				label: `${start} ~ ${end}`,
				isPartial: false,
			};
		}
	}
}

/** 枚举周期内的每一个用户日 */
export function enumerateUserDays(period: ReportPeriod): string[] {
	const days: string[] = [];
	let cursor = period.start;
	// 上限保护，避免异常输入造成死循环
	for (let i = 0; cursor <= period.end && i < 5000; i++) {
		days.push(cursor);
		cursor = addUserDays(cursor, 1);
	}
	return days;
}

/** 枚举周期内的自然周桶（首尾桶按周期边界裁剪） */
export function enumerateWeekBuckets(
	period: ReportPeriod
): { start: string; end: string; label: string }[] {
	const buckets: { start: string; end: string; label: string }[] = [];
	let cursor = period.start;
	for (let i = 0; cursor <= period.end && i < 500; i++) {
		const monday = getMondayOfWeek(cursor);
		const sunday = addUserDays(monday, 6);
		const bucketEnd = sunday > period.end ? period.end : sunday;
		buckets.push({
			start: cursor,
			end: bucketEnd,
			label: `${cursor} ~ ${bucketEnd}`,
		});
		cursor = addUserDays(bucketEnd, 1);
	}
	return buckets;
}

/**
 * 把用户日区间转换为真实时间窗（左闭右开）
 * 一天 = dayEndTime → 次日 dayEndTime - 1min
 */
export function getPeriodTimeWindow(
	period: ReportPeriod,
	dayEndTime: string
): { startISO: string; endExclusiveISO: string } {
	return {
		startISO: getUserStartOfDay(parseUserDate(period.start), dayEndTime),
		endExclusiveISO: getUserStartOfDay(parseUserDate(addUserDays(period.end, 1)), dayEndTime),
	};
}

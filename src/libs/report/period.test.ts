import { describe, expect, it } from 'vitest';
import {
	enumerateUserDays,
	enumerateWeekBuckets,
	getMondayOfWeek,
	getPeriodTimeWindow,
	isoWeekLabel,
	resolvePeriod,
	resolvePreviousPeriod,
} from './period';
import type { ReportPeriod } from './types';

describe('resolvePeriod', () => {
	it('把一周解析为周一到周日', () => {
		const period = resolvePeriod({
			scope: 'week',
			anchor: '2026-03-18', // 周三
			today: '2026-03-30',
		});
		expect(period).toEqual({
			scope: 'week',
			start: '2026-03-16',
			end: '2026-03-22',
			label: '2026-W12',
			isPartial: false,
		});
	});

	it('当期未结束时被今天截断', () => {
		const period = resolvePeriod({
			scope: 'week',
			anchor: '2026-03-18',
			today: '2026-03-18',
		});
		expect(period.start).toBe('2026-03-16');
		expect(period.end).toBe('2026-03-18');
		expect(period.isPartial).toBe(true);
	});

	it('解析自然月（含闰年 2 月）', () => {
		expect(
			resolvePeriod({ scope: 'month', anchor: '2026-03-18', today: '2026-12-31' })
		).toEqual({
			scope: 'month',
			start: '2026-03-01',
			end: '2026-03-31',
			label: '2026-03',
			isPartial: false,
		});

		const leap = resolvePeriod({
			scope: 'month',
			anchor: '2024-02-10',
			today: '2024-12-31',
		});
		expect(leap.end).toBe('2024-02-29');
	});

	it('解析自然年', () => {
		expect(resolvePeriod({ scope: 'year', anchor: '2026-07-01', today: '2027-05-01' })).toEqual(
			{
				scope: 'year',
				start: '2026-01-01',
				end: '2026-12-31',
				label: '2026',
				isPartial: false,
			}
		);
	});

	it('自定义区间会纠正颠倒的起止日期', () => {
		const period = resolvePeriod({
			scope: 'custom',
			anchor: '2026-03-18',
			customStart: '2026-03-22',
			customEnd: '2026-03-16',
			today: '2026-03-30',
		});
		expect(period.start).toBe('2026-03-16');
		expect(period.end).toBe('2026-03-22');
		expect(period.label).toBe('2026-03-16 ~ 2026-03-22');
	});
});

describe('isoWeekLabel', () => {
	it('按 ISO 规则标注跨年周', () => {
		expect(isoWeekLabel('2026-03-16')).toBe('2026-W12');
		expect(isoWeekLabel('2026-01-01')).toBe('2026-W01');
		expect(isoWeekLabel('2026-12-28')).toBe('2026-W53');
		// 2025-12-29 所在的周属于 ISO 2026 年第 1 周
		expect(isoWeekLabel('2025-12-29')).toBe('2026-W01');
	});
});

describe('resolvePreviousPeriod', () => {
	it('周/月/年取上一个同口径周期', () => {
		const week: ReportPeriod = {
			scope: 'week',
			start: '2026-03-16',
			end: '2026-03-22',
			label: '2026-W12',
			isPartial: false,
		};
		expect(resolvePreviousPeriod(week)).toEqual({
			scope: 'week',
			start: '2026-03-09',
			end: '2026-03-15',
			label: '2026-W11',
			isPartial: false,
		});

		const month: ReportPeriod = {
			scope: 'month',
			start: '2026-01-01',
			end: '2026-01-31',
			label: '2026-01',
			isPartial: false,
		};
		expect(resolvePreviousPeriod(month)).toEqual({
			scope: 'month',
			start: '2025-12-01',
			end: '2025-12-31',
			label: '2025-12',
			isPartial: false,
		});

		const year: ReportPeriod = {
			scope: 'year',
			start: '2026-01-01',
			end: '2026-12-31',
			label: '2026',
			isPartial: false,
		};
		expect(resolvePreviousPeriod(year).start).toBe('2025-01-01');
		expect(resolvePreviousPeriod(year).end).toBe('2025-12-31');
	});

	it('自定义区间取紧邻的等长前段', () => {
		const custom: ReportPeriod = {
			scope: 'custom',
			start: '2026-03-11',
			end: '2026-03-20',
			label: '2026-03-11 ~ 2026-03-20',
			isPartial: false,
		};
		expect(resolvePreviousPeriod(custom)).toEqual({
			scope: 'custom',
			start: '2026-03-01',
			end: '2026-03-10',
			label: '2026-03-01 ~ 2026-03-10',
			isPartial: false,
		});
	});
});

describe('enumerateUserDays / enumerateWeekBuckets', () => {
	it('枚举周期内的每一天', () => {
		const days = enumerateUserDays({
			scope: 'week',
			start: '2026-03-16',
			end: '2026-03-22',
			label: '2026-W12',
			isPartial: false,
		});
		expect(days).toHaveLength(7);
		expect(days[0]).toBe('2026-03-16');
		expect(days[6]).toBe('2026-03-22');
	});

	it('跨月枚举不会漏天', () => {
		const days = enumerateUserDays({
			scope: 'custom',
			start: '2026-02-26',
			end: '2026-03-03',
			label: 'custom',
			isPartial: false,
		});
		expect(days).toEqual([
			'2026-02-26',
			'2026-02-27',
			'2026-02-28',
			'2026-03-01',
			'2026-03-02',
			'2026-03-03',
		]);
	});

	it('年周期按自然周切桶（首尾桶裁剪到周期边界）', () => {
		const buckets = enumerateWeekBuckets({
			scope: 'year',
			start: '2026-01-01',
			end: '2026-12-31',
			label: '2026',
			isPartial: false,
		});
		expect(buckets).toHaveLength(53);
		expect(buckets[0]).toEqual({
			start: '2026-01-01',
			end: '2026-01-04',
			label: '2026-01-01 ~ 2026-01-04',
		});
		expect(buckets[buckets.length - 1]).toEqual({
			start: '2026-12-28',
			end: '2026-12-31',
			label: '2026-12-28 ~ 2026-12-31',
		});
	});
});

describe('getMondayOfWeek / getPeriodTimeWindow', () => {
	it('周日属于上一个周一开启的周', () => {
		expect(getMondayOfWeek('2026-03-22')).toBe('2026-03-16');
		expect(getMondayOfWeek('2026-03-16')).toBe('2026-03-16');
	});

	it('按 dayEndTime 计算真实时间窗（左闭右开）', () => {
		const window = getPeriodTimeWindow(
			{
				scope: 'week',
				start: '2026-03-16',
				end: '2026-03-22',
				label: '2026-W12',
				isPartial: false,
			},
			'04:00'
		);
		expect(window.startISO).toBe(new Date(2026, 2, 16, 4, 0, 0, 0).toISOString());
		expect(window.endExclusiveISO).toBe(new Date(2026, 2, 23, 4, 0, 0, 0).toISOString());
	});

	it('dayEndTime 为 00:00 时等价于自然日', () => {
		const window = getPeriodTimeWindow(
			{
				scope: 'custom',
				start: '2026-03-16',
				end: '2026-03-16',
				label: 'custom',
				isPartial: false,
			},
			'00:00'
		);
		expect(window.startISO).toBe(new Date(2026, 2, 16, 0, 0, 0, 0).toISOString());
		expect(window.endExclusiveISO).toBe(new Date(2026, 2, 17, 0, 0, 0, 0).toISOString());
	});
});

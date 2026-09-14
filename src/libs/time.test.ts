import { describe, expect, it } from 'vitest';
import { addUserDays, getUserWeekday, toUserDateString } from './time';

function localISO(year: number, month: number, day: number, hour = 0, minute = 0): string {
	return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

describe('addUserDays', () => {
	it('支持跨月、跨年与负数偏移', () => {
		expect(addUserDays('2026-03-16', 1)).toBe('2026-03-17');
		expect(addUserDays('2026-03-31', 1)).toBe('2026-04-01');
		expect(addUserDays('2026-01-01', -1)).toBe('2025-12-31');
		expect(addUserDays('2024-02-28', 1)).toBe('2024-02-29');
		expect(addUserDays('2026-03-16', 0)).toBe('2026-03-16');
	});
});

describe('toUserDateString', () => {
	it('默认按自然日归属', () => {
		expect(toUserDateString(localISO(2026, 3, 17, 1, 30))).toBe('2026-03-17');
	});

	it('按 dayEndTime 把凌晨的任务归到前一天', () => {
		expect(toUserDateString(localISO(2026, 3, 17, 1, 30), '04:00')).toBe('2026-03-16');
		expect(toUserDateString(localISO(2026, 3, 17, 3, 59), '04:00')).toBe('2026-03-16');
		expect(toUserDateString(localISO(2026, 3, 17, 4, 0), '04:00')).toBe('2026-03-17');
		expect(toUserDateString(localISO(2026, 3, 17, 23, 0), '04:00')).toBe('2026-03-17');
	});

	it('支持字符串时间戳', () => {
		expect(toUserDateString(localISO(2026, 3, 17, 1, 30), '04:00')).toBe('2026-03-16');
	});
});

describe('getUserWeekday', () => {
	it('返回 0=周日 … 6=周六', () => {
		expect(getUserWeekday('2026-03-16')).toBe(1); // 周一
		expect(getUserWeekday('2026-03-22')).toBe(0); // 周日
		expect(getUserWeekday('2026-03-21')).toBe(6); // 周六
	});
});

import { describe, expect, it } from 'vitest';
import { formatPercent, getMoneySharePercent } from './lib';

describe('getMoneySharePercent', () => {
	it('按金额占总额计算百分比', () => {
		expect(getMoneySharePercent(25, 100)).toBe(25);
		expect(getMoneySharePercent(50, 51)).toBeCloseTo(98.039, 2);
	});

	it('各商品占比之和约为 100%（口径自洽）', () => {
		const totalMoney = 51;
		const sum = [50, 1].reduce(
			(acc, moneyAmount) => acc + getMoneySharePercent(moneyAmount, totalMoney),
			0
		);
		expect(sum).toBeCloseTo(100, 6);
	});

	it('总额为 0 或非法值时返回 0，不产生 NaN', () => {
		expect(getMoneySharePercent(10, 0)).toBe(0);
		expect(getMoneySharePercent(10, -1)).toBe(0);
		expect(getMoneySharePercent(Number.NaN, 100)).toBe(0);
		expect(getMoneySharePercent(10, Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('formatPercent', () => {
	it('10% 及以上取整', () => {
		expect(formatPercent(41.6)).toBe('42%');
		expect(formatPercent(10)).toBe('10%');
		expect(formatPercent(100)).toBe('100%');
	});

	it('10% 以下保留 1 位小数，避免小项显示成 0%', () => {
		expect(formatPercent(3.44)).toBe('3.4%');
		expect(formatPercent(0.4)).toBe('0.4%');
	});

	it('0 与非有限值显示 0%', () => {
		expect(formatPercent(0)).toBe('0%');
		expect(formatPercent(-5)).toBe('0%');
		expect(formatPercent(Number.NaN)).toBe('0%');
	});
});

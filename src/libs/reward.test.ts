import { describe, expect, it } from 'vitest';
import { formatMoney, isCountedInConsumption, isValidMoneyCost, roundMoney } from './reward';

describe('isCountedInConsumption', () => {
	it('显式 false 表示不计入消费统计', () => {
		expect(isCountedInConsumption(false)).toBe(false);
	});

	it('显式 true 表示计入', () => {
		expect(isCountedInConsumption(true)).toBe(true);
	});

	it('缺省（旧数据）视为计入', () => {
		expect(isCountedInConsumption(undefined)).toBe(true);
	});
});

describe('isValidMoneyCost', () => {
	it('0 是合法值（不记金额）', () => {
		expect(isValidMoneyCost(0)).toBe(true);
	});

	it('正数（含小数）合法', () => {
		expect(isValidMoneyCost(1)).toBe(true);
		expect(isValidMoneyCost(0.5)).toBe(true);
	});

	it('负数与非法值不合法', () => {
		expect(isValidMoneyCost(-1)).toBe(false);
		expect(isValidMoneyCost(Number.NaN)).toBe(false);
		expect(isValidMoneyCost(Number.POSITIVE_INFINITY)).toBe(false);
	});
});

describe('roundMoney', () => {
	it('保留 2 位小数（沿用 Math.round 的记账口径）', () => {
		expect(roundMoney(1.006)).toBe(1.01);
		expect(roundMoney(0.5 * 3)).toBe(1.5);
		expect(roundMoney(25)).toBe(25);
		// 浮点边界：1.005 的二进制表示略小于 1.005，Math.round 向下取整
		// （与旧模型 pointsToMoney 的行为一致，不为它单独做偏斜舍入）
		expect(roundMoney(1.005)).toBe(1);
	});

	it('非法值归零，避免 NaN 污染统计', () => {
		expect(roundMoney(Number.NaN)).toBe(0);
		expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('formatMoney', () => {
	it('去掉多余的 0', () => {
		expect(formatMoney(12)).toBe('¥12');
		expect(formatMoney(12.5)).toBe('¥12.5');
		expect(formatMoney(12.34)).toBe('¥12.34');
	});

	it('0 与非法值都显示 ¥0', () => {
		expect(formatMoney(0)).toBe('¥0');
		expect(formatMoney(Number.NaN)).toBe('¥0');
	});
});

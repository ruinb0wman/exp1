import { describe, expect, it } from 'vitest';
import { isCountedInConsumption } from './reward';

describe('isCountedInConsumption', () => {
	it('显式 false 表示不计入消费统计', () => {
		expect(isCountedInConsumption(false)).toBe(false);
	});

	it('显式 true 表示计入', () => {
		expect(isCountedInConsumption(true)).toBe(true);
	});

	it('缺省（v7 之前写入的旧数据）视为计入', () => {
		expect(isCountedInConsumption(undefined)).toBe(true);
	});
});

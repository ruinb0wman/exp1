import { describe, expect, it } from 'vitest';
import type { RewardTemplate } from '@/db/types';
import {
	compareRewardOrder,
	formatMoney,
	isCountedInConsumption,
	isValidMoneyCost,
	MAX_PURCHASE_NOTE_LENGTH,
	normalizePurchaseNote,
	roundMoney,
	sortRewardTemplates,
} from './reward';

/** 构造商品模板（默认 100 积分） */
function createReward(overrides?: Partial<RewardTemplate>): RewardTemplate {
	return {
		id: 'reward-1',
		userId: 1,
		title: '吃饭',
		pointsCost: 100,
		moneyCost: 100,
		countInConsumption: true,
		enabled: true,
		replenishmentMode: 'none',
		icon: 'Pizza',
		createdAt: '2026-05-01T00:00:00.000Z',
		...overrides,
	};
}

/** 只取积分序列，避免比较整个对象 */
function costs(templates: RewardTemplate[]): number[] {
	return templates.map((template) => template.pointsCost);
}

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

describe('sortRewardTemplates', () => {
	it('按积分升序：0 积分的免费额度排在最前', () => {
		const sorted = sortRewardTemplates([
			createReward({ id: 'c', pointsCost: 100 }),
			createReward({ id: 'a', pointsCost: 0 }),
			createReward({ id: 'b', pointsCost: 10 }),
		]);

		expect(costs(sorted)).toEqual([0, 10, 100]);
	});

	it('同价按创建时间早→晚', () => {
		const sorted = sortRewardTemplates([
			createReward({ id: 'late', pointsCost: 10, createdAt: '2026-06-01T00:00:00.000Z' }),
			createReward({ id: 'early', pointsCost: 10, createdAt: '2026-05-01T00:00:00.000Z' }),
		]);

		expect(sorted.map((template) => template.id)).toEqual(['early', 'late']);
	});

	it('同价同创建时间按 id 兜底，且与入参顺序无关', () => {
		const a = createReward({ id: 'aaa', pointsCost: 10 });
		const b = createReward({ id: 'bbb', pointsCost: 10 });

		expect(sortRewardTemplates([a, b]).map((template) => template.id)).toEqual(['aaa', 'bbb']);
		expect(sortRewardTemplates([b, a]).map((template) => template.id)).toEqual(['aaa', 'bbb']);
	});

	it('缺失 createdAt 时按空串参与比较（同价组内排最前）', () => {
		const sorted = sortRewardTemplates([
			createReward({ id: 'has-date', pointsCost: 10 }),
			createReward({ id: 'no-date', pointsCost: 10, createdAt: undefined as never }),
		]);

		expect(sorted.map((template) => template.id)).toEqual(['no-date', 'has-date']);
	});

	it('非有限的 pointsCost 排到最后，不污染正常商品顺序', () => {
		const sorted = sortRewardTemplates([
			createReward({ id: 'nan', pointsCost: Number.NaN }),
			createReward({ id: 'ten', pointsCost: 10 }),
			createReward({ id: 'missing', pointsCost: undefined as never }),
			createReward({ id: 'zero', pointsCost: 0 }),
		]);

		expect(sorted.map((template) => template.id)).toEqual(['zero', 'ten', 'missing', 'nan']);
	});

	it('返回副本，不改原数组', () => {
		const input = [createReward({ id: 'ten', pointsCost: 10 }), createReward({ id: 'zero', pointsCost: 0 })];

		const sorted = sortRewardTemplates(input);

		expect(sorted).not.toBe(input);
		expect(input.map((template) => template.id)).toEqual(['ten', 'zero']);
		expect(sorted.map((template) => template.id)).toEqual(['zero', 'ten']);
	});

	it('compareRewardOrder 可单独用作比较器', () => {
		expect(compareRewardOrder(createReward({ pointsCost: 0 }), createReward({ pointsCost: 10 }))).toBeLessThan(0);
		expect(compareRewardOrder(createReward({ pointsCost: 10 }), createReward({ pointsCost: 10 }))).toBe(0);
		expect(compareRewardOrder(createReward({ pointsCost: 100 }), createReward({ pointsCost: 10 }))).toBeGreaterThan(0);
	});
});

describe('normalizePurchaseNote', () => {
	it('未填 / 纯空白一律视为未填（undefined）', () => {
		expect(normalizePurchaseNote(undefined)).toBeUndefined();
		expect(normalizePurchaseNote('')).toBeUndefined();
		expect(normalizePurchaseNote('   ')).toBeUndefined();
		expect(normalizePurchaseNote('\n\t ')).toBeUndefined();
		expect(normalizePurchaseNote(null as never)).toBeUndefined();
	});

	it('去掉首尾空白，保留内部内容', () => {
		expect(normalizePurchaseNote('  和朋友一起  ')).toBe('和朋友一起');
	});

	it('保留内部换行（消费明细按多行展示）', () => {
		expect(normalizePurchaseNote('第一行\n第二行')).toBe('第一行\n第二行');
	});

	it('超长时截断到上限', () => {
		const long = 'a'.repeat(MAX_PURCHASE_NOTE_LENGTH + 50);
		expect(normalizePurchaseNote(long)).toHaveLength(MAX_PURCHASE_NOTE_LENGTH);
	});
});

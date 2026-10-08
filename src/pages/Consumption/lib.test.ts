import { describe, expect, it } from 'vitest';
import type { RewardPurchase } from '@/db/types';
import { isCountedInConsumption } from '@/libs/reward';
import { groupPurchasesByReward } from './lib';

/** 造一条消费记录（快照用传入标题，便于测改名） */
function makePurchase(overrides: Partial<RewardPurchase> & {
	templateId: string;
	title: string;
	createdAt: string;
}): RewardPurchase {
	const { title, templateId, createdAt, ...rest } = overrides;
	return {
		id: `${templateId}-${createdAt}`,
		userId: 1,
		templateId,
		template: {
			templateId,
			title,
			icon: 'Coffee',
			iconColor: '#f56565',
			pointsCost: 100,
			moneyCost: 10,
		},
		quantity: 1,
		pointsCost: 100,
		pointsSpent: 100,
		moneyAmount: 10,
		createdAt,
		...rest,
	};
}

describe('groupPurchasesByReward', () => {
	it('同一奖品的多条记录聚成一组，笔数/件数/积分累加', () => {
		const groups = groupPurchasesByReward([
			makePurchase({ templateId: 'a', title: 'Coffee', createdAt: '2026-09-14T05:00:00.000Z', quantity: 2, pointsSpent: 200, moneyAmount: 20 }),
			makePurchase({ templateId: 'a', title: 'Coffee', createdAt: '2026-09-12T05:00:00.000Z', quantity: 3, pointsSpent: 300, moneyAmount: 30 }),
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0].count).toBe(2);
		expect(groups[0].quantity).toBe(5);
		expect(groups[0].pointsSpent).toBe(500);
		expect(groups[0].moneyAmount).toBe(50);
		expect(groups[0].records.map((r) => r.createdAt)).toEqual([
			'2026-09-14T05:00:00.000Z',
			'2026-09-12T05:00:00.000Z',
		]);
	});

	it('混合口径：积分含全部记录，金额只含计入统计的记录', () => {
		const groups = groupPurchasesByReward([
			makePurchase({
				templateId: 'a',
				title: 'Coffee',
				createdAt: '2026-09-14T05:00:00.000Z',
				template: {
					templateId: 'a',
					title: 'Coffee',
					icon: 'Coffee',
					pointsCost: 100,
					moneyCost: 10,
					countInConsumption: false,
				},
				moneyAmount: undefined,
			}),
			makePurchase({ templateId: 'a', title: 'Coffee', createdAt: '2026-09-12T05:00:00.000Z' }),
		]);

		expect(groups[0].count).toBe(2);
		expect(groups[0].pointsSpent).toBe(200);
		expect(groups[0].moneyAmount).toBe(10);
		expect(groups[0].uncountedCount).toBe(1);
	});

	it('奖品改名后组头用最近一次的快照标题，且不依赖入参顺序', () => {
		const purchaseA = makePurchase({ templateId: 'a', title: 'Old name', createdAt: '2026-09-12T05:00:00.000Z' });
		const purchaseB = makePurchase({ templateId: 'a', title: 'New name', createdAt: '2026-09-14T05:00:00.000Z' });

		expect(groupPurchasesByReward([purchaseB, purchaseA])[0].title).toBe('New name');
		expect(groupPurchasesByReward([purchaseA, purchaseB])[0].title).toBe('New name');
	});

	it('奖品被删除后仍能靠快照分组', () => {
		const groups = groupPurchasesByReward([
			makePurchase({ templateId: 'gone', title: 'Deleted reward', createdAt: '2026-09-14T05:00:00.000Z' }),
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0].title).toBe('Deleted reward');
	});

	it('按最近一次兑换时间倒序，与金额大小无关', () => {
		const groups = groupPurchasesByReward([
			makePurchase({ templateId: 'cheap', title: 'Cheap', createdAt: '2026-09-14T05:00:00.000Z', pointsSpent: 1, moneyAmount: 0 }),
			makePurchase({ templateId: 'pricey', title: 'Pricey', createdAt: '2026-09-10T05:00:00.000Z', pointsSpent: 999, moneyAmount: 999 }),
		]);

		expect(groups.map((g) => g.templateId)).toEqual(['cheap', 'pricey']);
	});

	it('空输入返回空数组', () => {
		expect(groupPurchasesByReward([])).toEqual([]);
	});

	it('分组金额求和与消费统计口径一致', () => {
		const purchases = [
			makePurchase({ templateId: 'a', title: 'A', createdAt: '2026-09-14T05:00:00.000Z', moneyAmount: 12.34 }),
			makePurchase({ templateId: 'b', title: 'B', createdAt: '2026-09-13T05:00:00.000Z', moneyAmount: 0.1 }),
			makePurchase({ templateId: 'b', title: 'B', createdAt: '2026-09-12T05:00:00.000Z', moneyAmount: 0.2 }),
			makePurchase({
				templateId: 'c',
				title: 'C',
				createdAt: '2026-09-11T05:00:00.000Z',
				template: {
					templateId: 'c',
					title: 'C',
					icon: 'Coffee',
					pointsCost: 0,
					moneyCost: 0,
					countInConsumption: false,
				},
				moneyAmount: undefined,
			}),
		];

		const groups = groupPurchasesByReward(purchases);
		const groupTotal = Math.round(
			groups.reduce((sum, group) => sum + group.moneyAmount, 0) * 100,
		) / 100;
		const countedTotal = Math.round(
			purchases
				.filter((p) => isCountedInConsumption(p.template.countInConsumption))
				.reduce((sum, p) => sum + (p.moneyAmount ?? 0), 0) * 100,
		) / 100;

		expect(groupTotal).toBe(countedTotal);
		expect(groupTotal).toBe(12.64);
	});
});

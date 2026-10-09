import type { PurchaseScope } from '@/composables/useRewardPurchases';
import type { RewardIconColor, RewardIconName, RewardPurchase } from '@/db/types';
import { isCountedInConsumption, roundMoney } from '@/libs/reward';
import { formatLocalDate } from '@/libs/time';

/** 消费统计周期：记账只需要月 / 年 / 自定义 */
export const PURCHASE_SCOPES: readonly PurchaseScope[] = ['month', 'year', 'custom'];

/**
 * 锚点日期在当前周期下的展示标签（月报显示年月，年报显示年份）
 */
export function formatAnchorLabel(scope: PurchaseScope, anchor: Date, fallback = ''): string {
	const dateStr = formatLocalDate(anchor);
	switch (scope) {
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
 * 平移锚点日期：月/年取该月/年的第一天再平移
 */
export function shiftAnchor(scope: PurchaseScope, anchor: Date, delta: number): Date {
	switch (scope) {
		case 'month':
			return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1, 12);
		case 'year':
			return new Date(anchor.getFullYear() + delta, 0, 1, 12);
		case 'custom':
		default:
			return anchor;
	}
}

/**
 * 按奖品分组的兑换记录（记录视角）
 */
export interface RewardRecordGroup {
	templateId: string;
	/** 组内最近一次购买的快照标题：奖品改名后显示新名字 */
	title: string;
	icon: RewardIconName;
	iconColor?: RewardIconColor;
	/** 组内全部记录，按时间倒序（含「不计入消费统计」的记录，明细保留撤销入口） */
	records: RewardPurchase[];
	/** 全部记录的笔数 / 件数 / 消耗积分 —— 记录视角要完整 */
	count: number;
	quantity: number;
	pointsSpent: number;
	/** 只累加「计入消费统计」的金额，与 stats.moneyAmount 同口径 */
	moneyAmount: number;
	/** 组内「不计入统计」的笔数，> 0 时组头提示 */
	uncountedCount: number;
	/** 组内最近一次兑换时间（ISO），口径值相同时的次级排序 */
	lastAt: string;
}

/** 兑换记录分组的排序口径：折合金额 / 消耗积分 */
export type RewardRecordSortKey = 'money' | 'points';

/** 排序口径的展示顺序，第一个为默认（金额） */
export const REWARD_RECORD_SORTS: readonly RewardRecordSortKey[] = ['money', 'points'];

/**
 * 把兑换记录按奖品分组
 *
 * key 用记录上的 `templateId`（= `RewardTemplate.id`），所以奖品被删除、
 * 改名都不影响分组：标题/图标取自购买快照。
 *
 * 金额口径与消费统计完全对齐（只算计入统计的记录），积分/件数则含全部记录 ——
 * 组头既能当「这个奖品花了多少钱」，也能当「兑换了几次」。
 *
 * `sortBy` 决定组间排序口径（默认折合金额）：金额口径下关闭「计入消费统计」的
 * 奖品金额恒为 0，会排在最后。
 */
export function groupPurchasesByReward(
	purchases: RewardPurchase[],
	sortBy: RewardRecordSortKey = 'money',
): RewardRecordGroup[] {
	const groupMap = new Map<string, RewardRecordGroup>();

	for (const purchase of purchases) {
		let group = groupMap.get(purchase.templateId);
		if (!group) {
			group = {
				templateId: purchase.templateId,
				title: purchase.template.title,
				icon: purchase.template.icon,
				iconColor: purchase.template.iconColor,
				records: [],
				count: 0,
				quantity: 0,
				pointsSpent: 0,
				moneyAmount: 0,
				uncountedCount: 0,
				lastAt: purchase.createdAt,
			};
			groupMap.set(purchase.templateId, group);
		}

		// 不依赖入参顺序：比出更晚的记录，就用它的快照当组头
		if (purchase.createdAt.localeCompare(group.lastAt) > 0) {
			group.lastAt = purchase.createdAt;
			group.title = purchase.template.title;
			group.icon = purchase.template.icon;
			group.iconColor = purchase.template.iconColor;
		}

		group.records.push(purchase);
		group.count += 1;
		group.quantity += purchase.quantity;
		group.pointsSpent += purchase.pointsSpent;
		if (isCountedInConsumption(purchase.template.countInConsumption)) {
			group.moneyAmount += purchase.moneyAmount ?? 0;
		} else {
			group.uncountedCount += 1;
		}
	}

	// 排序口径取哪个组头数字由调用方决定
	const metricOf = (group: RewardRecordGroup): number =>
		sortBy === 'points' ? group.pointsSpent : group.moneyAmount;

	return (
		Array.from(groupMap.values())
			.map((group) => ({
				...group,
				records: [...group.records].sort((a, b) =>
					b.createdAt.localeCompare(a.createdAt),
				),
				moneyAmount: roundMoney(group.moneyAmount),
			}))
			// 记录视角：该口径花得多的奖品排最前；口径值相同再按最近兑换、最后按标题
			.sort(
				(a, b) =>
					metricOf(b) - metricOf(a) ||
					b.lastAt.localeCompare(a.lastAt) ||
					a.title.localeCompare(b.title),
			)
	);
}

/**
 * 消费明细的时间展示，如 2026-09-14 13:20
 */
export function formatPurchaseDateTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const h = String(date.getHours()).padStart(2, '0');
	const min = String(date.getMinutes()).padStart(2, '0');
	return `${y}-${m}-${d} ${h}:${min}`;
}

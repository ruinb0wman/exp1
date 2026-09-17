import type { PurchaseScope } from '@/hooks/useRewardPurchases';
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
 * 商品金额占总额的百分比（商品占比与排名都以金额为准）
 * 总额为 0（全是不记金额的奖品）时返回 0，不产生 NaN
 */
export function getMoneySharePercent(moneyAmount: number, totalMoney: number): number {
	if (!Number.isFinite(moneyAmount) || !Number.isFinite(totalMoney) || totalMoney <= 0) {
		return 0;
	}
	return (moneyAmount / totalMoney) * 100;
}

/**
 * 占比文案：10% 及以上取整（41%），10% 以下保留 1 位小数（3.4%），避免小项全部显示成 0%
 */
export function formatPercent(percent: number): string {
	if (!Number.isFinite(percent) || percent <= 0) return '0%';
	return percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;
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

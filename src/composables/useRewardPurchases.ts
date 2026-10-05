import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { RewardPurchase } from "@/db/types";
import {
	getRewardPurchases,
	getRewardPurchaseStats,
	purchaseReward,
	deleteRewardPurchase,
	type RewardPurchaseStats,
} from "@/db/services";
import { resolvePeriod, getPeriodTimeWindow } from "@/libs/report/period";
import type { ReportPeriod } from "@/libs/report/types";
import { toUserDateString } from "@/libs/time";
import { useUserStore } from "@/store";

/** 消费统计的周期类型：记账只需要月/年/自定义 */
export type PurchaseScope = "month" | "year" | "custom";

// ==================== 消费记录 ====================

/**
 * 获取用户全部消费记录（按时间倒序）
 */
export function useRewardPurchases(
	userId: MaybeRefOrGetter<number | null>,
) {
	const purchases = ref<RewardPurchase[]>([]);
	const isLoading = ref(true);
	const error = ref<string | null>(null);

	async function refresh() {
		const id = toValue(userId);
		if (!id) {
			purchases.value = [];
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getRewardPurchases(id);
			purchases.value = data;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to load purchases";
		} finally {
			isLoading.value = false;
		}
	}

	watch(() => toValue(userId), () => void refresh(), { immediate: true });

	return { purchases, isLoading, error, refresh };
}

// ==================== 购买 / 删除回滚 ====================

/**
 * 购买即消费：扣积分 + 写消费记录（服务层单事务完成）
 * 删除记录会同时回滚积分与消费额度
 */
export function useRewardPurchaseActions() {
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function purchase(
		templateId: string,
		userId: number,
		quantity: number = 1,
		note?: string,
	) {
		isLoading.value = true;
		error.value = null;
		try {
			return await purchaseReward(templateId, userId, quantity, note);
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Purchase failed";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function remove(purchaseId: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await deleteRewardPurchase(purchaseId);
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to delete";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	return { purchase, remove, isLoading, error };
}

// ==================== 周期统计 ====================

interface UseRewardPurchaseStatsParams {
	userId: MaybeRefOrGetter<number | null>;
	scope: MaybeRefOrGetter<PurchaseScope>;
	/** 锚点用户日 YYYY-MM-DD */
	anchor: MaybeRefOrGetter<string>;
	customStart?: MaybeRefOrGetter<string | undefined>;
	customEnd?: MaybeRefOrGetter<string | undefined>;
}

/**
 * 按周期统计消费：复用 Reports 的周期解析，保证与积分明细/报告的时间口径一致
 */
export function useRewardPurchaseStats(
	params: UseRewardPurchaseStatsParams,
) {
	const userStore = useUserStore();

	const stats = ref<RewardPurchaseStats | null>(null);
	const period = ref<ReportPeriod | null>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);
	let requestId = 0;

	async function load() {
		const userId = toValue(params.userId);
		if (!userId) {
			stats.value = null;
			period.value = null;
			error.value = null;
			isLoading.value = false;
			return;
		}

		const currentRequest = requestId + 1;
		requestId = currentRequest;

		isLoading.value = true;
		error.value = null;
		try {
			const dayEndTime = userStore.user?.dayEndTime ?? "00:00";
			const today = toUserDateString(new Date(), dayEndTime);
			const resolved = resolvePeriod({
				scope: toValue(params.scope),
				anchor: toValue(params.anchor),
				customStart: toValue(params.customStart),
				customEnd: toValue(params.customEnd),
				today,
			});
			const { startISO, endExclusiveISO } = getPeriodTimeWindow(
				resolved,
				dayEndTime,
			);
			const result = await getRewardPurchaseStats(
				userId,
				startISO,
				endExclusiveISO,
			);

			if (requestId !== currentRequest) return;
			stats.value = result;
			period.value = resolved;
		} catch (loadError) {
			if (requestId !== currentRequest) return;
			error.value =
				loadError instanceof Error
					? loadError.message
					: "Failed to load spending stats";
			stats.value = null;
			period.value = null;
		} finally {
			if (requestId === currentRequest) {
				isLoading.value = false;
			}
		}
	}

	watch(
		[
			() => toValue(params.userId),
			() => toValue(params.scope),
			() => toValue(params.anchor),
			() => toValue(params.customStart),
			() => toValue(params.customEnd),
			() => userStore.user?.dayEndTime,
		],
		() => void load(),
		{ immediate: true },
	);

	return { stats, period, isLoading, error, refresh: load };
}

import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { PointsHistory } from "@/db/types";
import {
	getPointsHistoryPaged,
	getPointsStats,
	type PointsHistoryFilterType,
	type PointsStats,
} from "@/db/services/pointsHistoryService";

const DEFAULT_PAGE_SIZE = 20;

// 获取默认时间范围（最近30天，UTC时间）
function getDefaultDateRange(): { startDate: string; endDate: string } {
	const now = new Date();
	// 结束时间：现在（UTC）
	const endUTC = now.toISOString();
	// 开始时间：30天前的UTC开始
	const startUTC = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - 30,
			0,
			0,
			0,
			0,
		),
	).toISOString();

	return {
		startDate: startUTC,
		endDate: endUTC,
	};
}

interface UsePointsHistoryOptions {
	userId: MaybeRefOrGetter<number | null>;
	pageSize?: number;
	autoLoad?: boolean;
}

export function usePointsHistory(options: UsePointsHistoryOptions) {
	const { pageSize = DEFAULT_PAGE_SIZE, autoLoad = true } = options;

	const list = ref<PointsHistory[]>([]);
	const stats = ref<PointsStats | null>(null);
	const hasMore = ref(false);
	const total = ref(0);

	const isLoading = ref(false);
	const isLoadingMore = ref(false);
	const error = ref<string | null>(null);

	const filterType = ref<PointsHistoryFilterType>("all");
	const startDate = ref<string>(getDefaultDateRange().startDate);
	const endDate = ref<string>(getDefaultDateRange().endDate);

	// 使用 ref 来跟踪当前页码，避免闭包问题
	const page = ref(1);
	const initialized = ref(false);

	// 加载第一页数据
	async function loadFirstPage() {
		const userId = toValue(options.userId);
		if (!userId) {
			list.value = [];
			hasMore.value = false;
			total.value = 0;
			stats.value = null;
			return;
		}

		isLoading.value = true;
		error.value = null;

		try {
			const [result, statsData] = await Promise.all([
				getPointsHistoryPaged(userId, {
					page: 1,
					pageSize,
					type: filterType.value,
					startDate: startDate.value,
					endDate: endDate.value,
				}),
				getPointsStats(userId, startDate.value, endDate.value),
			]);

			list.value = result.list;
			hasMore.value = result.hasMore;
			total.value = result.total;
			stats.value = statsData;
			page.value = 1;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to load points history";
		} finally {
			isLoading.value = false;
		}
	}

	// 加载更多数据
	async function loadMore() {
		const userId = toValue(options.userId);
		if (!userId || isLoadingMore.value || !hasMore.value) return;

		isLoadingMore.value = true;

		try {
			const nextPage = page.value + 1;
			const result = await getPointsHistoryPaged(userId, {
				page: nextPage,
				pageSize,
				type: filterType.value,
				startDate: startDate.value,
				endDate: endDate.value,
			});

			list.value = [...list.value, ...result.list];
			hasMore.value = result.hasMore;
			page.value = nextPage;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to load more data";
		} finally {
			isLoadingMore.value = false;
		}
	}

	async function refresh() {
		await loadFirstPage();
	}

	function setFilterType(type: PointsHistoryFilterType) {
		filterType.value = type;
	}

	function setDateRange(start: string, end: string) {
		startDate.value = start;
		endDate.value = end;
	}

	function resetFilters() {
		filterType.value = "all";
		const defaultRange = getDefaultDateRange();
		startDate.value = defaultRange.startDate;
		endDate.value = defaultRange.endDate;
	}

	// 初始加载
	watch(
		() => toValue(options.userId),
		(id) => {
			if (autoLoad && id) {
				initialized.value = true;
				void loadFirstPage();
			}
		},
		{ immediate: true },
	);

	// 筛选条件变化时重新加载
	watch([filterType, startDate, endDate], () => {
		if (initialized.value) void loadFirstPage();
	});

	return {
		list,
		stats,
		hasMore,
		total,
		isLoading,
		isLoadingMore,
		error,
		filterType,
		startDate,
		endDate,
		loadMore,
		refresh,
		setFilterType,
		setDateRange,
		resetFilters,
	};
}

// 导出工具函数供外部使用
export { getDefaultDateRange };
export type { PointsHistoryFilterType, PointsStats };

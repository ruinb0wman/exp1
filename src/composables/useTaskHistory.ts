import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import {
	getTaskInstancesWithFilter,
	type TaskHistoryItem,
	getTaskStatistics,
	type TaskHistoryFilterStatus,
} from "@/db/services";

export type { TaskHistoryFilterStatus };

const DEFAULT_PAGE_SIZE = 20;

interface UseTaskHistoryOptions {
	userId: MaybeRefOrGetter<number | null>;
	pageSize?: number;
}

export interface TaskStats {
	total: number;
	completed: number;
	pending: number;
	skipped: number;
}

export function useTaskHistory({
	userId,
	pageSize = DEFAULT_PAGE_SIZE,
}: UseTaskHistoryOptions) {
	const list = ref<TaskHistoryItem[]>([]);
	const stats = ref<TaskStats | null>(null);
	const filterStatus = ref<TaskHistoryFilterStatus>("all");
	const offset = ref(0);
	const hasMore = ref(true);
	const total = ref(0);
	const isLoading = ref(false);
	const isLoadingMore = ref(false);
	const error = ref<string | null>(null);

	// 用于防止重复加载的标记
	let loading = false;

	// 加载统计数据
	async function loadStats() {
		const id = toValue(userId);
		if (id === null) return;
		try {
			const data = await getTaskStatistics(id);
			stats.value = data;
		} catch (err) {
			console.error("Failed to load task stats:", err);
		}
	}

	// 加载列表数据
	async function loadList(isLoadMore = false) {
		const id = toValue(userId);
		if (id === null) return;
		if (loading) return; // 防止重复加载

		loading = true;

		if (isLoadMore) {
			isLoadingMore.value = true;
		} else {
			isLoading.value = true;
			offset.value = 0;
		}
		error.value = null;

		try {
			const newOffset = isLoadMore ? offset.value : 0;
			const result = await getTaskInstancesWithFilter(
				id,
				filterStatus.value,
				newOffset,
				pageSize,
			);

			if (isLoadMore) {
				list.value = [...list.value, ...result.items];
			} else {
				list.value = result.items;
			}
			hasMore.value = result.hasMore;
			total.value = result.total;
			offset.value = newOffset + result.items.length;
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to load";
		} finally {
			isLoading.value = false;
			isLoadingMore.value = false;
			loading = false;
		}
	}

	// 初始加载和筛选变化时刷新
	watch(
		[() => toValue(userId), filterStatus],
		([id]) => {
			if (id !== null) {
				void loadList(false);
				void loadStats();
			}
		},
		{ immediate: true },
	);

	// 加载更多
	function loadMore() {
		if (!isLoadingMore.value && hasMore.value && !loading) {
			void loadList(true);
		}
	}

	// 切换筛选状态
	function setFilterStatus(status: TaskHistoryFilterStatus) {
		filterStatus.value = status;
		// 重置列表状态
		list.value = [];
		offset.value = 0;
		hasMore.value = true;
	}

	return {
		list,
		stats,
		hasMore,
		total,
		isLoading,
		isLoadingMore,
		error,
		filterStatus,
		loadMore,
		setFilterStatus,
		refresh: () => loadList(false),
	};
}

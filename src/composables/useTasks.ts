import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { storeToRefs } from "pinia";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import { useTaskStore } from "@/store";
import type { TaskWithTemplate } from "@/store/taskStore";
import {
	getAllTaskTemplates,
	getTaskTemplateById,
	createTaskTemplate,
	updateTaskTemplate,
	disableTaskTemplate,
	toggleTaskTemplateEnabled,
	getTaskInstancesByDate,
	completeTaskInstance,
	skipTaskInstance,
	resetTaskInstance,
	deleteTaskInstanceWithPoints,
	getTaskStatistics,
} from "@/db/services";

// ==================== TaskTemplate Composables ====================

/**
 * 获取所有任务模板
 */
export function useTaskTemplates(userId?: MaybeRefOrGetter<number | undefined>) {
	const templates = ref<TaskTemplate[]>([]);
	const isLoading = ref(true);
	const error = ref<string | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getAllTaskTemplates(toValue(userId));
			templates.value = data;
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to load tasks";
		} finally {
			isLoading.value = false;
		}
	}

	watch(() => toValue(userId), () => void refresh(), { immediate: true });

	return { templates, isLoading, error, refresh };
}

/**
 * 获取单个任务模板
 */
export function useTaskTemplate(id: MaybeRefOrGetter<string | null>) {
	const template = ref<TaskTemplate | null>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function refresh() {
		const templateId = toValue(id);
		if (templateId === null) return;
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getTaskTemplateById(templateId);
			template.value = data || null;
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to load task";
		} finally {
			isLoading.value = false;
		}
	}

	watch(() => toValue(id), () => void refresh(), { immediate: true });

	return { template, isLoading, error, refresh };
}

/**
 * 任务模板操作
 */
export function useTaskTemplateActions() {
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function create(
		template: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt">,
	) {
		isLoading.value = true;
		error.value = null;
		try {
			return await createTaskTemplate(template);
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to create task";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function update(
		id: string,
		updates: Partial<Omit<TaskTemplate, "id" | "createdAt">>,
	) {
		isLoading.value = true;
		error.value = null;
		try {
			await updateTaskTemplate(id, updates);
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to update task";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function disable(id: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await disableTaskTemplate(id);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to disable task";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function toggleEnabled(id: string, enabled?: boolean) {
		isLoading.value = true;
		error.value = null;
		try {
			await toggleTaskTemplateEnabled(id, enabled);
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to toggle task";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	return { create, update, disable, toggleEnabled, isLoading, error };
}

// ==================== TaskInstance Composables ====================

export type { TaskWithTemplate };

export function useTodayTasks(userId: MaybeRefOrGetter<number | undefined>) {
	const store = useTaskStore();
	const { todayTasks, isLoading, error } = storeToRefs(store);

	watch(
		() => toValue(userId),
		(id) => {
			if (id) {
				store.subscribeToTodayTasks(id);
			}
		},
		{ immediate: true },
	);

	return {
		tasks: todayTasks,
		isLoading,
		error,
		refresh: store.refreshTodayTasks,
	};
}

/**
 * 获取没有日期的任务列表 - 使用全局 Store
 */
export function useNoDateTasks(userId: MaybeRefOrGetter<number | undefined>) {
	const store = useTaskStore();
	const { noDateTasks, isLoading, error } = storeToRefs(store);

	watch(
		() => toValue(userId),
		(id) => {
			if (id) {
				store.subscribeToNoDateTasks(id);
			}
		},
		{ immediate: true },
	);

	return {
		tasks: noDateTasks,
		isLoading,
		error,
		refresh: store.refreshNoDateTasks,
	};
}

/**
 * 获取指定日期的任务（支持 dayEndTime）
 */
export function useTasksByDate(
	date: MaybeRefOrGetter<string>,
	userId?: MaybeRefOrGetter<number | undefined>,
) {
	const instances = ref<TaskInstance[]>([]);
	const isLoading = ref(true);
	const error = ref<string | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getTaskInstancesByDate(
				toValue(date),
				toValue(userId),
			);
			instances.value = data;
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Failed to load tasks";
		} finally {
			isLoading.value = false;
		}
	}

	watch([() => toValue(date), () => toValue(userId)], () => void refresh(), {
		immediate: true,
	});

	return { instances, isLoading, error, refresh };
}

/**
 * 任务实例操作
 */
export function useTaskInstanceActions() {
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function run(
		action: (instanceId: string) => Promise<unknown>,
		instanceId: string,
		failMessage: string,
	) {
		isLoading.value = true;
		error.value = null;
		try {
			await action(instanceId);
		} catch (err) {
			error.value = err instanceof Error ? err.message : failMessage;
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	return {
		complete: (instanceId: string) =>
			run(completeTaskInstance, instanceId, "Failed to complete task"),
		skip: (instanceId: string) =>
			run(skipTaskInstance, instanceId, "Failed to skip task"),
		reset: (instanceId: string) =>
			run(resetTaskInstance, instanceId, "Failed to reset task"),
		remove: (instanceId: string) =>
			run(
				deleteTaskInstanceWithPoints,
				instanceId,
				"Failed to delete task instance",
			),
		isLoading,
		error,
	};
}

// ==================== Statistics Composables ====================

/**
 * 获取任务统计
 */
export function useTaskStatistics(
	userId: MaybeRefOrGetter<number | undefined>,
	startDate?: MaybeRefOrGetter<string | undefined>,
	endDate?: MaybeRefOrGetter<string | undefined>,
) {
	const stats = ref<{
		total: number;
		completed: number;
		pending: number;
		skipped: number;
	} | null>(null);
	const isLoading = ref(true);
	const error = ref<string | null>(null);

	async function refresh() {
		const id = toValue(userId);
		if (!id) return;
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getTaskStatistics(id);
			stats.value = data;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to load statistics";
		} finally {
			isLoading.value = false;
		}
	}

	watch(
		[
			() => toValue(userId),
			() => toValue(startDate),
			() => toValue(endDate),
		],
		() => {
			if (toValue(userId)) void refresh();
		},
		{ immediate: true },
	);

	return { stats, isLoading, error, refresh };
}

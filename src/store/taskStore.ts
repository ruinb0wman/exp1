import { defineStore } from "pinia";
import { ref } from "vue";
import { liveQuery, type Subscription } from "dexie";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import {
	getTodayTaskInstances,
	getNoDateTaskInstances,
} from "@/db/services";
import { useUserStore } from "@/store/userStore";

export interface TaskWithTemplate {
	instance: TaskInstance;
	template: TaskTemplate;
}

// 订阅句柄放模块级（store 单例）
let todayTasksSubscription: Subscription | null = null;
let noDateTasksSubscription: Subscription | null = null;

export const useTaskStore = defineStore("task", () => {
	const todayTasks = ref<TaskWithTemplate[]>([]);
	const noDateTasks = ref<TaskWithTemplate[]>([]);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	function subscribeToTodayTasks(userId: number) {
		unsubscribeFromTodayTasks();

		const userStore = useUserStore();
		const dayEndTime = userStore.user?.dayEndTime ?? "00:00";

		const observable = liveQuery(() =>
			getTodayTaskInstances(userId, dayEndTime),
		);

		todayTasksSubscription = observable.subscribe({
			next: (data) => {
				todayTasks.value = data;
				isLoading.value = false;
				error.value = null;
			},
			error: (err) => {
				error.value =
					err instanceof Error ? err.message : "Failed to load today tasks";
				isLoading.value = false;
			},
		});

		isLoading.value = true;
	}

	function subscribeToNoDateTasks(userId: number) {
		unsubscribeFromNoDateTasks();

		const observable = liveQuery(() => getNoDateTaskInstances(userId));

		noDateTasksSubscription = observable.subscribe({
			next: (data) => {
				noDateTasks.value = data;
				isLoading.value = false;
				error.value = null;
			},
			error: (err) => {
				error.value =
					err instanceof Error
						? err.message
						: "Failed to load no date tasks";
				isLoading.value = false;
			},
		});

		isLoading.value = true;
	}

	function unsubscribeFromTodayTasks() {
		todayTasksSubscription?.unsubscribe();
		todayTasksSubscription = null;
	}

	function unsubscribeFromNoDateTasks() {
		noDateTasksSubscription?.unsubscribe();
		noDateTasksSubscription = null;
	}

	async function refreshTodayTasks() {
		// liveQuery 会自动更新，这里可以留空
	}

	async function refreshNoDateTasks() {
		// liveQuery 会自动更新，这里可以留空
	}

	return {
		todayTasks,
		noDateTasks,
		isLoading,
		error,

		subscribeToTodayTasks,
		subscribeToNoDateTasks,
		unsubscribeFromTodayTasks,
		unsubscribeFromNoDateTasks,
		refreshTodayTasks,
		refreshNoDateTasks,
	};
});

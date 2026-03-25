import { create } from "zustand";
import { liveQuery } from "dexie";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import {
	getTodayTaskInstances,
	getNoDateTaskInstances,
} from "@/db/services";

interface TaskWithTemplate {
	instance: TaskInstance;
	template: TaskTemplate;
}

interface TaskState {
	// 数据
	todayTasks: TaskWithTemplate[];
	noDateTasks: TaskWithTemplate[];
	isLoading: boolean;
	error: string | null;

	// 订阅管理
	todayTasksSubscription: (() => void) | null;
	noDateTasksSubscription: (() => void) | null;

	// 方法
	subscribeToTodayTasks: (userId: number, dayEndTime?: string) => void;
	subscribeToNoDateTasks: (userId: number) => void;
	unsubscribeFromTodayTasks: () => void;
	unsubscribeFromNoDateTasks: () => void;
	refreshTodayTasks: () => Promise<void>;
	refreshNoDateTasks: () => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
	todayTasks: [],
	noDateTasks: [],
	isLoading: false,
	error: null,
	todayTasksSubscription: null,
	noDateTasksSubscription: null,

	subscribeToTodayTasks: (userId, dayEndTime) => {
		// 如果已有订阅，先取消
		get().unsubscribeFromTodayTasks();

		const observable = liveQuery(() =>
			getTodayTaskInstances(userId, dayEndTime),
		);

		const subscription = observable.subscribe({
			next: (data) => {
				set({ todayTasks: data, isLoading: false, error: null });
			},
			error: (err) => {
				set({
					error:
						err instanceof Error
							? err.message
							: "Failed to load today tasks",
					isLoading: false,
				});
			},
		});

		set({
			todayTasksSubscription: () => subscription.unsubscribe(),
			isLoading: true,
		});
	},

	subscribeToNoDateTasks: (userId) => {
		get().unsubscribeFromNoDateTasks();

		const observable = liveQuery(() => getNoDateTaskInstances(userId));

		const subscription = observable.subscribe({
			next: (data) => {
				set({ noDateTasks: data, isLoading: false, error: null });
			},
			error: (err) => {
				set({
					error:
						err instanceof Error
							? err.message
							: "Failed to load no date tasks",
					isLoading: false,
				});
			},
		});

		set({
			noDateTasksSubscription: () => subscription.unsubscribe(),
			isLoading: true,
		});
	},

	unsubscribeFromTodayTasks: () => {
		const { todayTasksSubscription } = get();
		if (todayTasksSubscription) {
			todayTasksSubscription();
			set({ todayTasksSubscription: null });
		}
	},

	unsubscribeFromNoDateTasks: () => {
		const { noDateTasksSubscription } = get();
		if (noDateTasksSubscription) {
			noDateTasksSubscription();
			set({ noDateTasksSubscription: null });
		}
	},

	refreshTodayTasks: async () => {
		// liveQuery 会自动更新，这里可以留空
	},

	refreshNoDateTasks: async () => {
		// liveQuery 会自动更新，这里可以留空
	},
}));

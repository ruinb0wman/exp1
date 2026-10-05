import { defineStore } from "pinia";
import { ref } from "vue";
import { liveQuery, type Subscription } from "dexie";
import type { User, PointsHistoryType } from "@/db/types";
import {
	getOrCreateUser,
	updateUser as updateUserService,
	updateUserPoints as updateUserPointsService,
	calculateUserPoints,
} from "@/db/services";
import { getDB } from "@/db";

// 初始化锁,防止并发创建多个用户
let isInitializing = false;
let initPromise: Promise<void> | null = null;
// 积分变化订阅（store 是单例，放模块级即可）
let pointsSubscription: Subscription | null = null;

export const useUserStore = defineStore("user", () => {
	const user = ref<User | null>(null);
	const currentPoints = ref(0); // 从 pointsHistory 计算得到的当前积分
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function initUser() {
		// 如果已经在初始化中,等待初始化完成
		if (isInitializing && initPromise) {
			return initPromise;
		}

		// 如果已经有用户,不需要重新初始化
		if (user.value) {
			return;
		}

		isInitializing = true;
		isLoading.value = true;
		error.value = null;

		initPromise = (async () => {
			try {
				const result = await getOrCreateUser();
				// 计算当前积分
				const points = await calculateUserPoints(result.id);
				user.value = result;
				currentPoints.value = points;
				isLoading.value = false;
				// 启动积分变化订阅
				subscribeToPointsChanges();
			} catch (err) {
				error.value =
					err instanceof Error ? err.message : "Failed to initialize user";
				isLoading.value = false;
			} finally {
				isInitializing = false;
				initPromise = null;
			}
		})();

		return initPromise;
	}

	async function refreshUser() {
		if (!user.value) {
			await initUser();
			return;
		}

		isLoading.value = true;
		error.value = null;
		try {
			const refreshedUser = await getOrCreateUser();
			// 重新计算积分
			const points = await calculateUserPoints(refreshedUser.id);
			user.value = refreshedUser;
			currentPoints.value = points;
			isLoading.value = false;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to refresh user";
			isLoading.value = false;
		}
	}

	async function updateUser(
		updates: Partial<Omit<User, "id" | "createdAt">>,
	) {
		if (!user.value) {
			throw new Error("User not initialized");
		}

		isLoading.value = true;
		error.value = null;
		try {
			await updateUserService(user.value.id, updates);
			const updatedUser = await getOrCreateUser();
			// 重新计算积分
			const points = await calculateUserPoints(updatedUser.id);
			user.value = updatedUser;
			currentPoints.value = points;
			isLoading.value = false;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to update user";
			isLoading.value = false;
			throw err;
		}
	}

	async function addPoints(
		amount: number,
		type: PointsHistoryType,
		relatedInstanceId?: string,
	) {
		if (!user.value) {
			throw new Error("User not initialized");
		}

		isLoading.value = true;
		error.value = null;
		try {
			// updateUserPointsService 现在返回新的积分余额
			const newPoints = await updateUserPointsService(
				user.value.id,
				Math.abs(amount),
				type,
				relatedInstanceId,
			);
			// 直接使用返回的新积分，避免再次查询数据库
			currentPoints.value = newPoints;
			isLoading.value = false;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to add points";
			isLoading.value = false;
			throw err;
		}
	}

	async function spendPoints(
		amount: number,
		type: PointsHistoryType,
		relatedInstanceId?: string,
	) {
		if (!user.value) {
			throw new Error("User not initialized");
		}

		isLoading.value = true;
		error.value = null;
		try {
			// updateUserPointsService 现在返回新的积分余额
			const newPoints = await updateUserPointsService(
				user.value.id,
				-Math.abs(amount),
				type,
				relatedInstanceId,
			);
			// 直接使用返回的新积分，避免再次查询数据库
			currentPoints.value = newPoints;
			isLoading.value = false;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to spend points";
			isLoading.value = false;
			throw err;
		}
	}

	async function calculatePoints() {
		if (!user.value) {
			return 0;
		}
		const points = await calculateUserPoints(user.value.id);
		currentPoints.value = points;
		return points;
	}

	function subscribeToPointsChanges() {
		if (!user.value) return;

		// 如果已有订阅，先取消
		pointsSubscription?.unsubscribe();
		pointsSubscription = null;

		const userId = user.value.id;

		// 使用 liveQuery 订阅 pointsHistory 表的变化
		pointsSubscription = liveQuery(() => {
			const db = getDB();
			return db.pointsHistory.where("userId").equals(userId).toArray();
		}).subscribe({
			next: async () => {
				// 当 pointsHistory 表变化时，重新计算积分
				await calculatePoints();
			},
			error: (err) => {
				console.error("[UserStore] Points subscription error:", err);
			},
		});
	}

	function unsubscribeFromPointsChanges() {
		pointsSubscription?.unsubscribe();
		pointsSubscription = null;
	}

	return {
		user,
		currentPoints,
		isLoading,
		error,

		initUser,
		refreshUser,
		updateUser,
		addPoints,
		spendPoints,
		calculatePoints,
		subscribeToPointsChanges,
		unsubscribeFromPointsChanges,
	};
});

import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";
import { liveQuery, type Subscription } from "dexie";
import { getDB } from "@/db";
import { evaluateAll } from "@/db/services";
import { useAchievementStore } from "@/store/achievementStore";

const DEBOUNCE_MS = 800;

/**
 * 成就监听：源数据变化（防抖 800ms）后重新判定成就
 * 只订阅源表（任务/番茄/积分/消费）的派生签名，成就表自身的写入不会触发回环
 */
export function useAchievementWatcher(
	userId: MaybeRefOrGetter<number | undefined | null>,
) {
	const achievementStore = useAchievementStore();

	let cancelled = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let subscription: Subscription | null = null;

	const run = async (id: number) => {
		try {
			const unlocked = await evaluateAll(id);
			if (!cancelled && unlocked.length > 0) {
				achievementStore.pushUnlocks(unlocked);
			}
		} catch (error) {
			console.error("[AchievementWatcher] evaluate failed:", error);
		}
	};

	const stop = () => {
		cancelled = true;
		if (timer) clearTimeout(timer);
		timer = null;
		subscription?.unsubscribe();
		subscription = null;
	};

	watch(
		() => toValue(userId),
		(id) => {
			stop();

			if (!id) return;

			cancelled = false;

			// 启动时立即判定一次，补算离线期间的进度
			void run(id);

			subscription = liveQuery(async () => {
				const db = getDB();
				const [instances, sessions, purchases, records] = await Promise.all([
					db.taskInstances.where("userId").equals(id).toArray(),
					db.pomoSessions.where("userId").equals(id).toArray(),
					db.rewardPurchases.where("userId").equals(id).toArray(),
					db.pointsHistory.where("userId").equals(id).toArray(),
				]);

				const completedInstances = instances.filter(
					(item) => item.status === "completed",
				);
				const stageCount = instances.reduce((total, instance) => {
					const stages = instance.completedStages?.length ?? 0;
					const subtasks = instance.completedSubtasks?.filter(Boolean).length ?? 0;
					return total + stages + subtasks;
				}, 0);
				const completedSessions = sessions.filter(
					(item) => item.status === "completed",
				);

				return [
					completedInstances.length,
					stageCount,
					completedSessions.length,
					completedSessions.reduce(
						(total, session) => total + session.actualDuration,
						0,
					),
					records
						.filter((record) => record.amount > 0)
						.reduce((total, record) => total + record.amount, 0),
					records.length,
					purchases.length,
				].join(":");
			}).subscribe({
				next: () => {
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => {
						void run(id);
					}, DEBOUNCE_MS);
				},
				error: (error) => {
					console.error("[AchievementWatcher] liveQuery error:", error);
				},
			});
		},
		{ immediate: true },
	);

	onScopeDispose(stop);
}

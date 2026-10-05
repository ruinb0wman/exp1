import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { liveQuery, type Subscription } from "dexie";
import { getDB } from "@/db";
import type { Achievement } from "@/db/types";

/** 订阅用户的成就列表（响应式） */
export function useAchievements(userId: MaybeRefOrGetter<number | null>) {
	const achievements = ref<Achievement[]>([]);
	const isLoading = ref(Boolean(toValue(userId)));

	let subscription: Subscription | null = null;
	const stop = () => {
		subscription?.unsubscribe();
		subscription = null;
	};

	watch(
		() => toValue(userId),
		(id) => {
			stop();

			if (!id) {
				achievements.value = [];
				isLoading.value = false;
				return;
			}

			isLoading.value = true;
			subscription = liveQuery(() =>
				getDB().achievements.where("userId").equals(id).toArray(),
			).subscribe({
				next: (list) => {
					achievements.value = list;
					isLoading.value = false;
				},
				error: (error) => {
					console.error("[useAchievements] liveQuery error:", error);
					isLoading.value = false;
				},
			});
		},
		{ immediate: true },
	);

	onScopeDispose(stop);

	return { achievements, isLoading };
}

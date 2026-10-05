import { defineStore } from "pinia";
import type { Achievement } from "@/db/types";
import { ref } from "vue";

export const useAchievementStore = defineStore("achievement", () => {
	/** 待展示的解锁通知队列 */
	const pendingUnlocks = ref<Achievement[]>([]);

	function pushUnlocks(items: Achievement[]) {
		if (items.length === 0) return;
		const existing = new Set(pendingUnlocks.value.map((item) => item.id));
		const merged = [
			...pendingUnlocks.value,
			...items.filter((item) => !existing.has(item.id)),
		];
		pendingUnlocks.value = merged;
	}

	function shiftUnlock() {
		pendingUnlocks.value = pendingUnlocks.value.slice(1);
	}

	function clearUnlocks() {
		pendingUnlocks.value = [];
	}

	return { pendingUnlocks, pushUnlocks, shiftUnlock, clearUnlocks };
});

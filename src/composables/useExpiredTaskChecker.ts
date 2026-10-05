import { ref, toValue, type MaybeRefOrGetter } from "vue";
import { checkAndUpdateExpiredTasks } from "@/db/services";
import { useUserStore } from "@/store";

interface UseExpiredTaskCheckerOptions {
	userId: MaybeRefOrGetter<number | undefined>;
	onChecked?: (expiredIds: string[]) => void;
	onError?: (error: Error) => void;
}

export function useExpiredTaskChecker(options: UseExpiredTaskCheckerOptions) {
	const { onChecked, onError } = options;
	const userStore = useUserStore();

	const isChecking = ref(false);
	const hasChecked = ref(false);

	async function checkExpiredTasks(
		runOptions: { skipIfAlreadyChecked?: boolean } = {},
	): Promise<string[]> {
		const { skipIfAlreadyChecked = true } = runOptions;

		const userId = toValue(options.userId);
		const dayEndTime = userStore.user?.dayEndTime;

		if (!userId || !dayEndTime) {
			return [];
		}

		if (skipIfAlreadyChecked && hasChecked.value) {
			return [];
		}

		isChecking.value = true;

		if (skipIfAlreadyChecked) {
			hasChecked.value = true;
		}

		try {
			const expiredIds = await checkAndUpdateExpiredTasks(userId, dayEndTime);

			onChecked?.(expiredIds);
			return expiredIds;
		} catch (error) {
			if (skipIfAlreadyChecked) {
				hasChecked.value = false;
			}

			const err = error instanceof Error ? error : new Error(String(error));
			onError?.(err);
			throw err;
		} finally {
			isChecking.value = false;
		}
	}

	function resetCheckFlag() {
		hasChecked.value = false;
	}

	return {
		isChecking,
		hasChecked,
		checkExpiredTasks,
		resetCheckFlag,
	};
}

import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { getDB } from "@/db";
import {
	checkAllTemplatesAndGenerate,
	backfillMissingInstancesForAllTemplates,
} from "@/db/middleware/taskTemplateMiddleware";
import { checkAndUpdateExpiredTasks } from "@/db/services";
import { useUserStore } from "@/store";

interface UsePageInitializerOptions {
	userId?: MaybeRefOrGetter<number | undefined>;
	onInitialized?: () => void;
	onError?: (error: Error) => void;
}

export function usePageInitializer({
	userId,
	onInitialized,
	onError,
}: UsePageInitializerOptions) {
	const userStore = useUserStore();
	const hasInitialized = ref(false);

	async function initialize() {
		const id = toValue(userId);

		if (!id) {
			return;
		}

		if (hasInitialized.value) {
			return;
		}

		hasInitialized.value = true;

		const dayEndTime = userStore.user?.dayEndTime ?? "00:00";

		console.log(`[pageInit] ====== 页面初始化开始 ======`);
		console.log(`[pageInit] userId=${id}`);

		try {
			const db = getDB();
			console.log(`[pageInit] 步骤1: checkAllTemplatesAndGenerate...`);
			const generatedCount = await checkAllTemplatesAndGenerate(db, id);
			console.log(`[pageInit] 步骤1完成: 生成今日实例 ${generatedCount} 条`);

			console.log(`[pageInit] 步骤2: backfillMissingInstancesForAllTemplates...`);
			const backfillCount = await backfillMissingInstancesForAllTemplates(
				db,
				id,
			);
			console.log(`[pageInit] 步骤2完成: 回填历史实例 ${backfillCount} 条`);

			console.log(`[pageInit] 步骤3: checkAndUpdateExpiredTasks...`);
			const expiredIds = await checkAndUpdateExpiredTasks(id, dayEndTime);
			console.log(`[pageInit] 步骤3完成: 过期实例 ${expiredIds.length} 条`);

			console.log(`[pageInit] ====== 页面初始化完成 ======`);

			onInitialized?.();
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			console.error("[pageInit] ❌ 初始化失败:", err);
			onError?.(err);
			throw err;
		}
	}

	// userId 从无到有时自动初始化一次（等价于 React 版 useEffect 的依赖变化）
	watch(
		() => toValue(userId),
		(id) => {
			if (id) void initialize();
		},
		{ immediate: true },
	);

	return { initialize };
}

import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { RewardTemplate, ReplenishmentRecord } from "@/db/types";
import {
	getAllRewardTemplates,
	getRewardTemplateById,
	createRewardTemplate,
	updateRewardTemplate,
	deleteRewardTemplate,
	toggleRewardTemplateEnabled,
	getStoreRewardTemplates,
	getReplenishmentRecordsByTemplateId,
} from "@/db/services";

// ==================== RewardTemplate Composables ====================

/**
 * 获取所有奖励模板
 */
export function useRewardTemplates(
	userId?: MaybeRefOrGetter<number | undefined>,
) {
	const templates = ref<RewardTemplate[]>([]);
	const isLoading = ref(true);
	const error = ref<string | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getAllRewardTemplates(toValue(userId));
			templates.value = data;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to load rewards";
		} finally {
			isLoading.value = false;
		}
	}

	watch(() => toValue(userId), () => void refresh(), { immediate: true });

	return { templates, isLoading, error, refresh };
}

/**
 * 获取单个奖励模板
 */
export function useRewardTemplate(id: MaybeRefOrGetter<string | null>) {
	const template = ref<RewardTemplate | null>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function refresh() {
		const templateId = toValue(id);
		if (templateId === null) return;
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getRewardTemplateById(templateId);
			template.value = data || null;
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to load reward";
		} finally {
			isLoading.value = false;
		}
	}

	watch(() => toValue(id), () => void refresh(), { immediate: true });

	return { template, isLoading, error, refresh };
}

/**
 * 奖励模板操作
 */
export function useRewardTemplateActions() {
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function create(
		template: Omit<RewardTemplate, "id" | "createdAt" | "updatedAt">,
	) {
		isLoading.value = true;
		error.value = null;
		try {
			return await createRewardTemplate(template);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to create reward";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function update(
		id: string,
		updates: Partial<Omit<RewardTemplate, "id" | "createdAt">>,
	) {
		isLoading.value = true;
		error.value = null;
		try {
			await updateRewardTemplate(id, updates);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to update reward";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function remove(id: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await deleteRewardTemplate(id);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to delete reward";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	async function toggleEnabled(id: string, enabled?: boolean) {
		isLoading.value = true;
		error.value = null;
		try {
			await toggleRewardTemplateEnabled(id, enabled);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : "Failed to toggle reward";
			throw err;
		} finally {
			isLoading.value = false;
		}
	}

	return { create, update, remove, toggleEnabled, isLoading, error };
}

// ==================== Store Composables ====================

export interface StoreReward {
	template: RewardTemplate;
	availableCount: number;
}

/**
 * 获取商店奖励列表（带剩余消费额度）
 */
export function useStoreRewards(userId: MaybeRefOrGetter<number | undefined>) {
	const rewards = ref<StoreReward[]>([]);
	const isLoading = ref(true);
	const error = ref<string | null>(null);
	let requestId = 0;

	async function refresh() {
		const id = toValue(userId);
		const currentRequest = requestId + 1;
		requestId = currentRequest;

		isLoading.value = true;
		error.value = null;
		try {
			const data = await getStoreRewardTemplates(id!);
			if (requestId !== currentRequest) return;
			rewards.value = data as StoreReward[];
		} catch (err) {
			if (requestId !== currentRequest) return;
			error.value = err instanceof Error ? err.message : "Failed to load store";
		} finally {
			if (requestId === currentRequest) {
				isLoading.value = false;
			}
		}
	}

	watch(
		() => toValue(userId),
		(id) => {
			if (id) void refresh();
		},
		{ immediate: true },
	);

	return { rewards, isLoading, error, refresh };
}

// ==================== 消费额度补货 ====================

export function useReplenishmentHistory(
	templateId: MaybeRefOrGetter<string>,
) {
	const records = ref<ReplenishmentRecord[]>([]);
	const isLoading = ref(true);
	const error = ref<string | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const data = await getReplenishmentRecordsByTemplateId(
				toValue(templateId),
			);
			records.value = data;
		} catch (err) {
			error.value =
				err instanceof Error
					? err.message
					: "Failed to load replenishment history";
		} finally {
			isLoading.value = false;
		}
	}

	watch(
		() => toValue(templateId),
		(id) => {
			if (id) void refresh();
		},
		{ immediate: true },
	);

	return { records, isLoading, error, refresh };
}

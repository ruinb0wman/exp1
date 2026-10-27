<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import Header from "@/components/Header.vue";
import { RChipGroup } from "@ruinb0w/ui";
import { useUserStore } from "@/store";
import {
	useRewardTemplates,
	useRewardTemplateActions,
} from "@/composables/useRewards";
import {
	rewardFilters,
	filterTemplatesByEnabled,
	getRewardStats,
	type RewardFilter,
} from "./lib";
import RewardList from "./components/RewardList.vue";

/**
 * 奖品管理：列出全部奖品（含已停用），行内开关启用状态
 *
 * 商店只列启用的奖品，所以停用后必须从这里找回来 —— 这也是奖品不再提供
 * 「删除」的原因：删除会连带清掉补货记录，且重新建同名奖品会让消费页出现
 * 两个同名分组。
 */
const router = useRouter();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const {
	templates,
	isLoading,
	error,
	refresh,
} = useRewardTemplates(() => user.value?.id);
const {
	toggleEnabled,
	isLoading: isActionLoading,
} = useRewardTemplateActions();

const filter = ref<RewardFilter>("All");

const filteredTemplates = computed(() =>
	filterTemplatesByEnabled(templates.value, filter.value),
);

const stats = computed(() => getRewardStats(templates.value));

async function handleToggleEnabled(id: string, currentEnabled: boolean) {
	try {
		await toggleEnabled(id, !currentEnabled);
		void refresh();
	} catch (err) {
		console.error("Failed to toggle reward:", err);
	}
}
</script>

<template>
	<div class="min-h-screen pb-24 bg-background">
		<Header title="Reward Management" back />

		<!-- Filter Tabs -->
		<div class="px-4 pb-4">
			<RChipGroup
				:options="rewardFilters.map((o) => ({ label: o, value: o }))"
				:model-value="filter"
				@change="(v) => (filter = v as RewardFilter)"
			/>
		</div>

		<!-- Stats Summary -->
		<div class="px-4 pb-4">
			<div
				class="rounded-xl bg-surface border border-border px-4 py-3 flex items-center justify-between text-sm"
			>
				<span class="text-text-secondary">
					{{ stats.enabledCount }} enabled
				</span>
				<span class="text-text-muted">
					{{ stats.disabledCount }} disabled · {{ stats.totalCount }} total
				</span>
			</div>
		</div>

		<main class="px-4">
			<RewardList
				:templates="filteredTemplates"
				:is-loading="isLoading"
				:error="error"
				:is-action-loading="isActionLoading"
				:filter="filter"
				@refresh="refresh"
				@edit="(id) => router.push(`/rewards/${id}`)"
				@toggle-enabled="handleToggleEnabled"
			/>
		</main>
	</div>
</template>

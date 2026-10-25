<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { Loader2 } from "@lucide/vue";
import Header from "@/components/Header.vue";
import PointsHistoryCard from "@/components/PointsHistoryCard.vue";
import { useUserStore } from "@/store";
import {
	usePointsHistory,
	type PointsHistoryFilterType,
} from "@/composables/usePointsHistory";
import DateRangePicker from "./components/DateRangePicker.vue";

const userStore = useUserStore();
const { user, currentPoints } = storeToRefs(userStore);

const filterTabs: { key: PointsHistoryFilterType; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "task_completion", label: "Tasks" },
	{ key: "reward_exchange", label: "Rewards" },
	{ key: "achievement", label: "Achievements" },
];

const {
	list,
	stats,
	hasMore,
	total,
	isLoading,
	isLoadingMore,
	error,
	filterType,
	startDate,
	endDate,
	loadMore,
	setFilterType,
	setDateRange,
} = usePointsHistory({
	userId: () => user.value?.id ?? null,
	pageSize: 20,
});

onMounted(() => void userStore.calculatePoints());

const adminAdjustmentClass = computed(() =>
	(stats.value?.adminAdjustment ?? 0) >= 0 ? "text-green-500" : "text-primary",
);
</script>

<template>
	<div class="bg-background">
		<!-- Header -->
		<Header title="Points History" back />

		<!-- Stats Summary -->
		<div class="px-4 py-3">
			<div class="rounded-xl bg-surface border border-border p-4">
				<div class="grid grid-cols-3 gap-4 text-center">
					<div>
						<p class="text-text-secondary text-xs mb-1">Income</p>
						<p class="text-green-500 text-xl font-bold">
							{{ isLoading ? "-" : (stats?.income ?? 0) }}
						</p>
					</div>
					<div>
						<p class="text-text-secondary text-xs mb-1">Expense</p>
						<p class="text-primary text-xl font-bold">
							{{ isLoading ? "-" : (stats?.expense ?? 0) }}
						</p>
					</div>
					<div>
						<p class="text-text-secondary text-xs mb-1">exp</p>
						<p class="text-text-primary text-xl font-bold">{{ currentPoints }}</p>
					</div>
				</div>
				<div
					v-if="stats"
					class="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs"
				>
					<div class="flex justify-between text-text-secondary">
						<span>Task Reward:</span>
						<span class="text-green-500">+{{ stats.taskReward }}</span>
					</div>
					<div class="flex justify-between text-text-secondary">
						<span>Undo Deduction:</span>
						<span class="text-primary">-{{ stats.taskUndo }}</span>
					</div>
					<div class="flex justify-between text-text-secondary">
						<span>Purchases:</span>
						<span class="text-primary">-{{ stats.rewardExchange }}</span>
					</div>
					<div class="flex justify-between text-text-secondary">
						<span>Admin Adjustment:</span>
						<span :class="adminAdjustmentClass">
							{{ stats.adminAdjustment >= 0 ? "+" : "" }}{{ stats.adminAdjustment }}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Filter Bar -->
		<div class="px-4 py-2 flex items-center justify-between sticky top-[var(--spacing-header)] bg-background z-10">
			<!-- Filter Tabs -->
			<div class="flex gap-1 bg-surface rounded-lg p-1">
				<button
					v-for="tab in filterTabs"
					:key="tab.key"
					:class="`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
						filterType === tab.key
							? 'bg-primary text-white'
							: 'text-text-secondary hover:text-text-primary'
					}`"
					@click="setFilterType(tab.key)"
				>
					{{ tab.label }}
				</button>
			</div>

			<!-- Date Range Picker -->
			<DateRangePicker
				:start-date="startDate"
				:end-date="endDate"
				@change="setDateRange"
			/>
		</div>

		<!-- Total Count -->
		<div class="px-4 py-2 text-text-muted text-sm">{{ `${total ?? 0} records` }}</div>

		<!-- History List -->
		<div class="px-4 pb-8">
			<div v-if="isLoading" class="flex items-center justify-center py-12">
				<Loader2 class="w-6 h-6 text-primary animate-spin" />
			</div>

			<div v-else-if="error" class="text-center py-12 text-text-secondary">
				<p>{{ error }}</p>
			</div>

			<div v-else-if="list.length === 0" class="text-center py-12 text-text-secondary">
				<p>No records</p>
			</div>

			<div v-else class="flex flex-col gap-2">
				<PointsHistoryCard v-for="item in list" :key="item.id" :item="item" />

				<!-- Load More -->
				<button
					v-if="hasMore"
					:disabled="isLoadingMore"
					class="mt-4 py-3 rounded-xl bg-surface border border-border text-text-primary font-medium hover:bg-surface-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					@click="loadMore"
				>
					<span v-if="isLoadingMore" class="flex items-center justify-center gap-2">
						<Loader2 class="w-4 h-4 animate-spin" />
						Loading...
					</span>
					<template v-else>Load More</template>
				</button>

				<p v-if="!hasMore && list.length > 0" class="text-center text-text-muted text-sm py-4">
					No more records
				</p>
			</div>
		</div>
	</div>
</template>

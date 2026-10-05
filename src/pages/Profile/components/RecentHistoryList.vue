<script setup lang="ts">
import { History } from "lucide-vue-next";
import type { PointsHistory } from "@/db/types";
import PointsHistoryCard from "@/components/PointsHistoryCard.vue";

defineProps<{
	history: PointsHistory[];
	isLoading: boolean;
}>();

const skeletons = [0, 1, 2];
</script>

<template>
	<h2 class="text-text-primary text-[22px] font-bold px-4 pb-3 pt-2">Recent Activity</h2>
	<div class="flex flex-col px-4 gap-2 pb-8">
		<template v-if="isLoading">
			<div
				v-for="index in skeletons"
				:key="index"
				class="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border animate-pulse"
			>
				<div class="w-10 h-10 shrink-0 rounded-lg bg-surface-light" />
				<div class="flex-1 space-y-2">
					<div class="h-4 bg-surface-light rounded w-3/4" />
					<div class="h-3 bg-surface-light rounded w-1/2" />
				</div>
				<div class="h-4 bg-surface-light rounded w-12" />
			</div>
		</template>

		<div
			v-else-if="history.length === 0"
			class="flex flex-col items-center justify-center py-12 text-text-secondary"
		>
			<History class="w-12 h-12 mb-3 opacity-50" />
			<p class="text-base">No recent activity</p>
			<p class="text-sm opacity-70">Complete tasks to see your progress</p>
		</div>

		<PointsHistoryCard v-for="item in history" v-else :key="item.id" :item="item" />
	</div>
</template>

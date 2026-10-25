<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle, Flame, Gift, TrendingUp } from "@lucide/vue";
import type { Component } from "vue";
import type { ProfileStats } from "@/composables/useProfileStats";

const props = defineProps<{
	stats: ProfileStats;
	isLoading: boolean;
}>();

interface StatItemConfig {
	label: string;
	value: string;
	icon: Component;
}

function formatNumber(num: number): string {
	return num.toLocaleString("en-US");
}

const statsConfig = computed<StatItemConfig[]>(() => [
	{
		label: "Total Points Earned",
		value: formatNumber(props.stats.totalPointsEarned),
		icon: TrendingUp,
	},
	{
		label: "Tasks Completed",
		value: formatNumber(props.stats.tasksCompleted),
		icon: CheckCircle,
	},
	{
		label: "Purchases",
		value: formatNumber(props.stats.itemsRedeemed),
		icon: Gift,
	},
	{
		label: "Current Streak",
		value: `${props.stats.currentStreak} Days`,
		icon: Flame,
	},
]);
</script>

<template>
	<h2 class="text-text-primary text-[22px] font-bold px-4 pb-3 pt-5">Progress Stats</h2>
	<div class="p-4 pt-0">
		<div class="grid grid-cols-2 gap-4">
			<div
				v-for="stat in statsConfig"
				:key="stat.label"
				class="rounded-xl bg-surface p-4 border border-border"
			>
				<div class="flex items-center gap-2 mb-1">
					<component :is="stat.icon" class="w-4 h-4 text-primary" />
					<p class="text-text-secondary text-sm font-medium">{{ stat.label }}</p>
				</div>
				<p class="text-text-primary text-2xl font-bold">
					{{ isLoading ? "-" : stat.value }}
				</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		completedCount: number;
		totalCount: number;
		earnedPoints?: number;
		estimatedTotalPoints?: number;
	}>(),
	{
		earnedPoints: 0,
		estimatedTotalPoints: 0,
	},
);

const progress = computed(() =>
	props.totalCount > 0 ? (props.completedCount / props.totalCount) * 100 : 0,
);
</script>

<template>
	<div class="mb-2">
		<div class="flex items-center justify-between mb-2">
			<p class="text-text-primary text-base font-normal">
				You've completed {{ completedCount }} of {{ totalCount }} tasks today.
			</p>
			<p class="text-base font-normal">
				<span class="text-white">{{ earnedPoints }}</span>
				<span class="text-text-secondary mx-1">/</span>
				<span class="text-primary">{{ estimatedTotalPoints }}</span>
			</p>
		</div>
		<div class="w-full rounded-full bg-surface h-2">
			<div
				class="h-2 rounded-full bg-primary transition-all duration-300"
				:style="{ width: `${progress}%` }"
			/>
		</div>
	</div>
</template>

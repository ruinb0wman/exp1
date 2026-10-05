<script setup lang="ts">
import { computed } from "vue";
import type { TaskStats } from "@/composables/useTaskHistory";

const props = defineProps<{
	stats: TaskStats | null;
	isLoading: boolean;
}>();

const items = computed(() => [
	{ label: "All", value: props.stats?.total ?? 0, colorClass: "text-text-primary" },
	{ label: "Pending", value: props.stats?.pending ?? 0, colorClass: "text-primary" },
	{
		label: "Completed",
		value: props.stats?.completed ?? 0,
		colorClass: "text-green-500",
	},
	{ label: "Skipped", value: props.stats?.skipped ?? 0, colorClass: "text-text-muted" },
]);
</script>

<template>
	<div class="px-4 py-3 shrink-0">
		<div class="rounded-xl bg-surface border border-border p-4">
			<div class="grid grid-cols-4 gap-2 text-center">
				<div v-for="item in items" :key="item.label">
					<p class="text-text-secondary text-xs mb-1">{{ item.label }}</p>
					<p :class="`text-lg font-bold ${item.colorClass}`">
						{{ isLoading ? "-" : item.value }}
					</p>
				</div>
			</div>
		</div>
	</div>
</template>

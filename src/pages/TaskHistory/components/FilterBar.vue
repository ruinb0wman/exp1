<script setup lang="ts">
import type { TaskHistoryFilterStatus } from "@/composables/useTaskHistory";
import { filterTabs } from "../lib";

defineProps<{
	filterStatus: TaskHistoryFilterStatus;
	total: number;
}>();

const emit = defineEmits<{ filterChange: [status: TaskHistoryFilterStatus] }>();
</script>

<template>
	<div class="px-4 py-2 flex items-center justify-between sticky top-[var(--spacing-header)] bg-background z-10 shrink-0">
		<!-- Filter Tabs -->
		<div class="flex gap-1 bg-surface rounded-lg p-1">
			<button
				v-for="tab in filterTabs"
				:key="tab.key"
				:class="`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
					filterStatus === tab.key
						? 'bg-primary text-white'
						: 'text-text-secondary hover:text-text-primary'
				}`"
				@click="emit('filterChange', tab.key)"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- Total Count -->
		<span class="text-text-muted text-sm">{{ total }} records</span>
	</div>
</template>

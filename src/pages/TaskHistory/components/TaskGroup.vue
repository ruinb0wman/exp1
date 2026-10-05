<script setup lang="ts">
import type { TaskHistoryItem } from "@/db/services";
import TaskInstanceCard from "@/components/TaskInstanceCard/index.vue";

defineProps<{
	dateGroup: string;
	tasks: TaskHistoryItem[];
}>();

const emit = defineEmits<{ taskClick: [item: TaskHistoryItem] }>();

function handleClick(data: { template: TaskHistoryItem["template"]; instance?: TaskHistoryItem["instance"] }) {
	if (data.instance) emit("taskClick", { template: data.template, instance: data.instance });
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<!-- Date Group Header -->
		<div class="flex items-center gap-3 py-2">
			<div class="flex-1 h-px bg-border" />
			<span class="text-text-muted text-sm font-medium">{{ dateGroup }}</span>
			<div class="flex-1 h-px bg-border" />
		</div>

		<!-- Tasks in this group -->
		<div class="flex flex-col gap-2">
			<TaskInstanceCard
				v-for="item in tasks"
				:key="item.instance.id"
				:template="item.template"
				:instance="item.instance"
				@click="handleClick"
			/>
		</div>
	</div>
</template>

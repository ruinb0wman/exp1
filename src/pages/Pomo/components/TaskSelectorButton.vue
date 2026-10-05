<script setup lang="ts">
import { CheckCircle2, ChevronDown, Circle } from "lucide-vue-next";
import type { TaskWithTemplate } from "@/composables/useTasks";

withDefaults(
	defineProps<{
		/** 当前选中的任务 */
		selectedTask?: TaskWithTemplate;
		/** 是否禁用 */
		disabled?: boolean;
	}>(),
	{
		disabled: false,
	},
);

const emit = defineEmits<{ click: [] }>();
</script>

<template>
	<button
		:disabled="disabled"
		class="w-full bg-surface rounded-2xl p-4 flex items-center gap-3 transition-colors hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed"
		@click="emit('click')"
	>
		<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
			<CheckCircle2 v-if="selectedTask" class="w-5 h-5 text-primary" />
			<Circle v-else class="w-5 h-5 text-text-muted" />
		</div>
		<div class="flex-1 text-left">
			<p class="text-sm text-text-secondary">Current Focus Task</p>
			<p class="text-white font-medium truncate">
				{{ selectedTask ? selectedTask.template.title : "No task selected" }}
			</p>
		</div>
		<ChevronDown v-if="!disabled" class="w-5 h-5 text-text-muted" />
	</button>
</template>

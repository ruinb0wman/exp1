<script setup lang="ts">
import TaskTemplateCard from "@/components/TaskTemplateCard.vue";
import { BLoadingState } from "@ruinb0w/ui";
import { BErrorState } from "@ruinb0w/ui";
import { BEmptyState } from "@ruinb0w/ui";
import type { TaskTemplate } from "@/db/types";

defineProps<{
	templates: TaskTemplate[];
	isLoading: boolean;
	error: string | null;
	isActionLoading: boolean;
	filter: string;
}>();

const emit = defineEmits<{
	refresh: [];
	edit: [id: string];
	toggleEnabled: [id: string, currentEnabled: boolean];
}>();
</script>

<template>
	<BLoadingState v-if="isLoading" message="Loading tasks..." />

	<BErrorState
		v-else-if="error"
		title="Failed to load tasks"
		retry-label="Retry"
		@retry="emit('refresh')"
	/>

	<BEmptyState
		v-else-if="templates.length === 0"
		title="No tasks found"
		:description="
			filter === 'All' ? 'Create your first task' : 'Try a different filter'
		"
	/>

	<div v-else class="flex flex-col gap-3">
		<TaskTemplateCard
			v-for="template in templates"
			:key="template.id"
			:id="template.id!"
			:title="template.title"
			:description="template.description"
			:level="template.level"
			:repeat-mode="template.repeatMode"
			:enabled="template.enabled"
			:complete-rule="template.completeRule"
			:subtasks="template.subtasks"
			:is-action-loading="isActionLoading"
			@click="emit('edit', template.id!)"
			@toggle-enabled="
				(e) => {
					e.stopPropagation();
					emit('toggleEnabled', template.id!, template.enabled);
				}
			"
		/>
	</div>
</template>

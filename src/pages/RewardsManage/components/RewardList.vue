<script setup lang="ts">
import { Package } from "@lucide/vue";
import { REmptyState } from "@ruinb0w/ui";
import { RErrorState } from "@ruinb0w/ui";
import { RLoadingState } from "@ruinb0w/ui";
import type { RewardTemplate } from "@/db/types";
import RewardTemplateRow from "./RewardTemplateRow.vue";

const props = defineProps<{
	templates: RewardTemplate[];
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
	<RLoadingState v-if="props.isLoading" message="Loading rewards..." />

	<RErrorState
		v-else-if="props.error"
		title="Failed to load rewards"
		retry-label="Retry"
		@retry="emit('refresh')"
	/>

	<REmptyState
		v-else-if="props.templates.length === 0"
		title="No rewards found"
		:description="
			props.filter === 'All'
				? 'Create rewards from the Store'
				: 'Try a different filter'
		"
	>
		<Package class="w-8 h-8" />
	</REmptyState>

	<div v-else class="flex flex-col gap-3">
		<RewardTemplateRow
			v-for="template in props.templates"
			:key="template.id"
			:template="template"
			:is-action-loading="props.isActionLoading"
			@click="emit('edit', template.id)"
			@toggle-enabled="emit('toggleEnabled', template.id, template.enabled)"
		/>
	</div>
</template>

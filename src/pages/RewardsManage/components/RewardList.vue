<script setup lang="ts">
import { Package } from "lucide-vue-next";
import EmptyState from "@/components/EmptyState.vue";
import ErrorState from "@/components/ErrorState.vue";
import LoadingState from "@/components/LoadingState.vue";
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
	<LoadingState v-if="props.isLoading" message="Loading rewards..." />

	<ErrorState
		v-else-if="props.error"
		title="Failed to load rewards"
		retry-label="Retry"
		@retry="emit('refresh')"
	/>

	<EmptyState
		v-else-if="props.templates.length === 0"
		title="No rewards found"
		:description="
			props.filter === 'All'
				? 'Create rewards from the Store'
				: 'Try a different filter'
		"
	>
		<Package class="w-8 h-8" />
	</EmptyState>

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

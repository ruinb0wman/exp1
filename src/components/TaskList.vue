<script setup lang="ts">
import { History, ListTodo } from "@lucide/vue";
import { useRouter } from "vue-router";
import { RCollapsible, REmptyState, RSkeletonCard } from "@ruinb0w/ui";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import TaskInstanceCard from "@/components/TaskInstanceCard/index.vue";

interface TaskWithTemplate {
	instance: TaskInstance;
	template: TaskTemplate;
}

const props = withDefaults(
	defineProps<{
		tasks: TaskWithTemplate[];
		isLoading: boolean;
		title?: string;
		showViewAll?: boolean;
		showHistory?: boolean;
		emptyMessage?: string;
		collapsible?: boolean;
		defaultCollapsed?: boolean;
	}>(),
	{
		title: "Today's Tasks",
		showViewAll: true,
		showHistory: false,
		emptyMessage: "No tasks for today",
		collapsible: false,
		defaultCollapsed: false,
	},
);

const emit = defineEmits<{
	taskClick: [instance: TaskInstance, template: TaskTemplate];
}>();

const router = useRouter();

const skeletons = [0, 1, 2];

function handleTaskClick(data: {
	template: TaskTemplate;
	instance?: TaskInstance;
}) {
	if (data.instance) emit("taskClick", data.instance, data.template);
}
</script>

<template>
	<RCollapsible
		:title="title"
		:count="props.collapsible ? props.tasks.length : null"
		:collapsible="props.collapsible"
		:default-collapsed="props.defaultCollapsed"
	>
		<template v-if="props.showViewAll || props.showHistory" #actions>
			<button
				v-if="props.showViewAll"
				class="task-list-action task-list-action--primary"
				@click="router.push('/tasks')"
			>
				<ListTodo :size="16" />
				<span>All Tasks</span>
			</button>
			<button
				v-if="props.showHistory"
				class="task-list-action"
				@click="router.push('/task-history')"
			>
				<History :size="16" />
				<span>History</span>
			</button>
		</template>

		<div v-if="props.isLoading" class="task-list">
			<RSkeletonCard
				v-for="index in skeletons"
				:key="index"
				:lines="2"
				:widths="['60%', '40%']"
				:height="72"
			/>
		</div>

		<REmptyState
			v-else-if="props.tasks.length === 0"
			:title="props.emptyMessage"
			description="Create a task to get started"
		>
			<ListTodo :size="32" />
		</REmptyState>

		<div v-else class="task-list">
			<TaskInstanceCard
				v-for="{ instance, template } in props.tasks"
				:key="instance.id"
				:template="template"
				:instance="instance"
				@click="handleTaskClick"
			/>
		</div>
	</RCollapsible>
</template>

<style scoped>
.task-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.task-list-action {
	display: inline-flex;
	align-items: center;
	gap: var(--space-1);
	padding: var(--space-1) var(--space-3);
	border: 0;
	border-radius: var(--radius-full);
	background: none;
	color: var(--text-secondary);
	font: inherit;
	font-size: var(--font-sm);
	font-weight: 500;
	cursor: pointer;
	transition: background var(--motion-fast) var(--motion-ease);
}

.task-list-action:hover {
	background: var(--bg-card);
}

.task-list-action--primary {
	color: var(--color-primary);
}
</style>

<script setup lang="ts">
import { History, ListTodo } from "@lucide/vue";
import { useRouter } from "vue-router";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import TaskInstanceCard from "@/components/TaskInstanceCard/index.vue";

interface TaskWithTemplate {
	instance: TaskInstance;
	template: TaskTemplate;
}

withDefaults(
	defineProps<{
		tasks: TaskWithTemplate[];
		isLoading: boolean;
		title?: string;
		showViewAll?: boolean;
		showHistory?: boolean;
		emptyMessage?: string;
	}>(),
	{
		title: "Today's Tasks",
		showViewAll: true,
		showHistory: false,
		emptyMessage: "No tasks for today",
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
	<div>
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-text-primary text-lg font-bold tracking-tight">{{ title }}</h2>
			<div class="flex items-center gap-2">
				<button
					v-if="showViewAll"
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
					@click="router.push('/tasks')"
				>
					<ListTodo class="w-4 h-4" />
					<span>All Tasks</span>
				</button>
				<button
					v-if="showHistory"
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface transition-colors"
					@click="router.push('/task-history')"
				>
					<History class="w-4 h-4" />
					<span>History</span>
				</button>
			</div>
		</div>

		<!-- 空状态 -->
		<div
			v-if="!isLoading && tasks.length === 0"
			class="flex flex-col items-center justify-center py-16 text-text-muted"
		>
			<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
				<ListTodo class="w-8 h-8" />
			</div>
			<p class="text-base font-medium">{{ emptyMessage }}</p>
			<p class="text-sm mt-1">Create a task to get started</p>
		</div>

		<!-- 列表 -->
		<div v-else class="flex flex-col gap-3">
			<template v-if="isLoading">
				<div
					v-for="index in skeletons"
					:key="index"
					class="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border"
				>
					<div class="flex items-center gap-4 flex-1">
						<div class="w-10 h-10 rounded-lg bg-surface-light animate-pulse" />
						<div class="flex flex-col justify-center flex-1 gap-2">
							<div class="h-4 w-32 bg-surface-light rounded animate-pulse" />
							<div class="h-3 w-20 bg-surface-light rounded animate-pulse" />
						</div>
					</div>
					<div class="h-4 w-12 bg-surface-light rounded animate-pulse" />
				</div>
			</template>
			<TaskInstanceCard
				v-for="{ instance, template } in tasks"
				v-else
				:key="instance.id"
				:template="template"
				:instance="instance"
				@click="handleTaskClick"
			/>
		</div>
	</div>
</template>

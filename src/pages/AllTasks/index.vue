<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { History } from "@lucide/vue";
import Header from "@/components/Header.vue";
import HeaderActionButton from "@/components/HeaderActionButton.vue";
import { RChipGroup } from "@ruinb0w/ui";
import { useTaskTemplateActions, useTaskTemplates } from "@/composables/useTasks";
import { useUserStore } from "@/store";
import {
	categories,
	type Category,
	filterTemplatesByCategory,
	getTaskStats,
} from "./lib";
import TaskList from "./components/TaskList.vue";
import StatsSummary from "./components/StatsSummary.vue";
import FloatingAddButton from "./components/FloatingAddButton.vue";

const router = useRouter();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const {
	templates,
	isLoading,
	error,
	refresh,
} = useTaskTemplates(() => user.value?.id);
const {
	toggleEnabled,
	isLoading: isActionLoading,
} = useTaskTemplateActions();
const filter = ref<Category>("All");

// 筛选任务
const filteredTemplates = computed(() =>
	filterTemplatesByCategory(templates.value, filter.value),
);

// 启用/禁用任务
async function handleToggleEnabled(id: string, currentEnabled: boolean) {
	try {
		await toggleEnabled(id, !currentEnabled);
		void refresh();
	} catch (error) {
		console.error("Failed to toggle task:", error);
	}
}

// 上移/下移任务已移除：列表顺序完全由模板的 level（执行等级）决定

const taskStats = computed(() => getTaskStats(templates.value));

function setFilter(next: Category) {
	filter.value = next;
}
</script>

<template>
	<div class="min-h-screen pb-24 bg-background">
		<Header title="All Tasks" back>
			<template #right>
				<HeaderActionButton
					side="end"
					label="Task History"
					@click="router.push('/task-history')"
				>
					<History class="w-5 h-5" />
				</HeaderActionButton>
			</template>
		</Header>

		<!-- Filter Tabs -->
		<div class="px-4 pb-4">
			<RChipGroup
				:options="categories.map((c) => ({ label: c, value: c }))"
				:model-value="filter"
				@change="(v) => setFilter(v as Category)"
			/>
		</div>

		<!-- Stats Summary -->
		<div class="px-4 pb-4">
			<StatsSummary
				:enabled-count="taskStats.enabledCount"
				:total-count="taskStats.totalCount"
			/>
		</div>

		<!-- Tasks List -->
		<main class="px-4">
			<TaskList
				:templates="filteredTemplates"
				:is-loading="isLoading"
				:error="error"
				:is-action-loading="isActionLoading"
				:filter="filter"
				@refresh="refresh"
				@edit="(id) => router.push(`/tasks/${id}`)"
				@toggle-enabled="handleToggleEnabled"
			/>
		</main>

		<!-- Floating Add Button -->
		<FloatingAddButton @click="router.push('/tasks/new')" />
	</div>
</template>

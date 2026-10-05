<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { Loader2 } from "lucide-vue-next";
import Header from "@/components/Header.vue";
import TaskDetailPopup from "@/components/TaskDetailPopup.vue";
import { useUserStore } from "@/store";
import { useTaskHistory } from "@/composables/useTaskHistory";
import { useTaskInstanceActions } from "@/composables/useTasks";
import type { TaskHistoryItem } from "@/db/services";
import { groupTasksByDate } from "./lib";
import StatsSummary from "./components/StatsSummary.vue";
import TaskGroup from "./components/TaskGroup.vue";
import FilterBar from "./components/FilterBar.vue";
import LoadingMore from "./components/LoadingMore.vue";

const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const scrollContainerRef = ref<HTMLDivElement | null>(null);

const {
	list,
	stats,
	hasMore,
	total,
	isLoading,
	isLoadingMore,
	error,
	filterStatus,
	loadMore,
	refresh,
	setFilterStatus,
} = useTaskHistory({
	userId: () => user.value?.id ?? null,
	pageSize: 20,
});

const { complete, reset, remove: deleteInstance } = useTaskInstanceActions();

const selectedTask = ref<TaskHistoryItem | null>(null);
const isPopupOpen = ref(false);
const isActionLoading = ref(false);

const taskGroups = computed(() =>
	Array.from(groupTasksByDate(list.value).entries()).map(
		([dateGroup, tasks]) => ({ dateGroup, tasks }),
	),
);

// 将 TaskHistoryItem 转换为 TaskInstance 和 TaskTemplate
const selectedInstance = computed(() => selectedTask.value?.instance ?? null);
const selectedTemplate = computed(() => selectedTask.value?.template ?? null);

// 滚动加载逻辑
function handleScroll() {
	const container = scrollContainerRef.value;
	if (!container || !hasMore.value || isLoadingMore.value) return;

	const scrollBottom = container.scrollTop + container.clientHeight;
	const threshold = container.scrollHeight - 100; // 距离底部100px时触发加载

	if (scrollBottom >= threshold) {
		void loadMore();
	}
}

onMounted(() => {
	scrollContainerRef.value?.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
	scrollContainerRef.value?.removeEventListener("scroll", handleScroll);
});

// 处理任务点击
function handleTaskClick(item: TaskHistoryItem) {
	selectedTask.value = item;
	isPopupOpen.value = true;
}

// 关闭弹窗
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function handleClosePopup() {
	isPopupOpen.value = false;
	// 延迟清空选中任务，让关闭动画完成
	closeTimer = setTimeout(() => {
		selectedTask.value = null;
	}, 300);
}

onUnmounted(() => {
	if (closeTimer) clearTimeout(closeTimer);
});

// 处理任务操作（完成/重置）
async function handleTaskAction(action: "complete" | "reset", instanceId: string) {
	isActionLoading.value = true;
	try {
		if (action === "complete") {
			await complete(instanceId);
		} else {
			await reset(instanceId);
		}
		// 积分变更由中间件自动处理
		// 刷新列表
		await refresh();
		// 关闭弹窗
		handleClosePopup();
	} catch (err) {
		console.error("Failed to perform action:", err);
	} finally {
		isActionLoading.value = false;
	}
}

// 处理删除任务实例（同时删除其积分记录）
async function handleDeleteInstance() {
	if (!selectedInstance.value) return;
	isActionLoading.value = true;
	try {
		await deleteInstance(selectedInstance.value.id!);
		// 刷新列表
		await refresh();
		// 关闭弹窗
		handleClosePopup();
	} catch (err) {
		console.error("Failed to delete task instance:", err);
	} finally {
		isActionLoading.value = false;
	}
}
</script>

<template>
	<div class="bg-background flex flex-col">
		<!-- Header -->
		<Header title="Task History" back />

		<!-- Stats Summary -->
		<StatsSummary :stats="stats" :is-loading="isLoading" />

		<!-- Filter Bar -->
		<FilterBar
			:filter-status="filterStatus"
			:total="total"
			@filter-change="setFilterStatus"
		/>

		<!-- Task List - Scrollable -->
		<div ref="scrollContainerRef" class="flex-1 overflow-y-auto px-4 pb-8">
			<div v-if="isLoading" class="flex items-center justify-center py-12">
				<Loader2 class="w-6 h-6 text-primary animate-spin" />
			</div>

			<div v-else-if="error" class="text-center py-12 text-text-secondary">
				<p>{{ error }}</p>
			</div>

			<div v-else-if="list.length === 0" class="text-center py-12 text-text-secondary">
				<p>No records yet</p>
			</div>

			<div v-else class="flex flex-col gap-4">
				<TaskGroup
					v-for="group in taskGroups"
					:key="group.dateGroup"
					:date-group="group.dateGroup"
					:tasks="group.tasks"
					@task-click="handleTaskClick"
				/>

				<!-- Loading More Indicator -->
				<div class="py-4">
					<LoadingMore
						:is-loading-more="isLoadingMore"
						:has-more="hasMore"
						:list-length="list.length"
					/>
				</div>
			</div>
		</div>

		<!-- 任务详情 Popup -->
		<TaskDetailPopup
			:is-open="isPopupOpen"
			:instance="selectedInstance"
			:template="selectedTemplate"
			:is-loading="isActionLoading"
			@close="handleClosePopup"
			@complete="() => selectedInstance && handleTaskAction('complete', selectedInstance.id!)"
			@reset="() => selectedInstance && handleTaskAction('reset', selectedInstance.id!)"
			@delete="handleDeleteInstance"
		/>
	</div>
</template>

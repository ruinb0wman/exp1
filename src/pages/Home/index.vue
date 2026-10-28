<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Plus } from "@lucide/vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useUserStore } from "@/store";
import {
	useEarlierTasks,
	useNoDateTasks,
	useTaskInstanceActions,
	useTodayTasks,
} from "@/composables/useTasks";
import { usePageInitializer } from "@/composables/usePageInitializer";
import { RProgress } from "@ruinb0w/ui";
import HomeHeader from "@/components/HomeHeader.vue";
import TaskList from "@/components/TaskList.vue";
import TaskDetailPopup from "@/components/TaskDetailPopup.vue";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import {
	completeTaskInPopup,
	resetTaskInPopup,
	incrementTaskCount,
	toggleSubtaskCompletion,
	calculateTaskStats,
	filterTodayTasks,
	filterPendingTasks,
	calculateEstimatedTotalPoints,
	calculateTodayEarnedPoints,
} from "./lib";

const router = useRouter();
const userStore = useUserStore();
const { user, currentPoints, isLoading: isUserLoading } = storeToRefs(userStore);

// userId 从无到有时自动跑一次页面初始化
usePageInitializer({
	userId: () => user.value?.id,
	onError: (error) => {
		console.error("Failed to initialize page:", error);
	},
});

// 任务详情 popup 状态
const selectedTask = ref<{
	instance: TaskInstance;
	template: TaskTemplate;
} | null>(null);
const isDetailOpen = ref(false);

const {
	tasks,
	isLoading: isTasksLoading,
	refresh: refreshTasks,
} = useTodayTasks(() => user.value?.id);
const {
	tasks: noDateTasks,
	isLoading: isNoDateTasksLoading,
	refresh: refreshNoDateTasks,
} = useNoDateTasks(() => user.value?.id);
const { tasks: earlierTasks } = useEarlierTasks(() => user.value?.id);
const { complete, reset, remove: deleteInstance } = useTaskInstanceActions();

// 进入页面时重新计算积分
onMounted(() => void userStore.calculatePoints());

// 处理点击任务卡片
function handleTaskClick(instance: TaskInstance, template: TaskTemplate) {
	selectedTask.value = { instance, template };
	isDetailOpen.value = true;
}

// 关闭任务详情 popup
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function handleCloseDetail() {
	isDetailOpen.value = false;
	closeTimer = setTimeout(() => {
		selectedTask.value = null;
	}, 300);
}

onUnmounted(() => {
	if (closeTimer) clearTimeout(closeTimer);
});

// 在 popup 中完成任务
async function handleCompleteInPopup() {
	if (!selectedTask.value) return;
	const { instance, template } = selectedTask.value;
	try {
		await completeTaskInPopup(
			instance,
			template,
			complete,
			refreshTasks,
			refreshNoDateTasks,
			handleCloseDetail,
		);
	} catch (error) {
		console.error("Failed to complete task:", error);
	}
}

// 在 popup 中撤回任务
async function handleResetInPopup() {
	if (!selectedTask.value) return;
	const { instance, template } = selectedTask.value;
	try {
		await resetTaskInPopup(
			instance,
			template,
			reset,
			refreshTasks,
			refreshNoDateTasks,
			handleCloseDetail,
		);
	} catch (error) {
		console.error("Failed to reset task:", error);
	}
}

// 在 popup 中增加一次进度（用于 count 类型任务）
async function handleIncrementCount() {
	if (!selectedTask.value) return;
	const { instance, template } = selectedTask.value;
	try {
		const updated = await incrementTaskCount(
			instance,
			template,
			refreshTasks,
			refreshNoDateTasks,
		);

		// 刷新选中的任务状态
		if (updated && updated.template) {
			selectedTask.value = {
				instance: updated.instance,
				template: updated.template,
			};
		}
	} catch (error) {
		console.error("Failed to increment count:", error);
	}
}

// 在 popup 中切换子任务完成状态（用于 subtask 类型任务）
async function handleToggleSubtask(index: number) {
	if (!selectedTask.value) return;
	const { instance } = selectedTask.value;
	try {
		const completedSubtasks = instance.completedSubtasks || [];
		const newCompleted = !completedSubtasks[index];

		const updated = await toggleSubtaskCompletion(
			instance,
			index,
			newCompleted,
			refreshTasks,
			refreshNoDateTasks,
		);

		// 刷新选中的任务状态
		if (updated && updated.template) {
			selectedTask.value = {
				instance: updated.instance,
				template: updated.template,
			};
		}
	} catch (error) {
		console.error("Failed to toggle subtask:", error);
	}
}

// 在 popup 中删除任务实例（同时删除其积分记录，下次进入页面时按最新模板重新生成）
async function handleDeleteInPopup() {
	if (!selectedTask.value) return;
	const { instance } = selectedTask.value;
	try {
		await deleteInstance(instance.id!);
		handleCloseDetail();
		// liveQuery 会自动刷新今日任务列表
	} catch (error) {
		console.error("Failed to delete task instance:", error);
	}
}

const pendingTasks = computed(() => filterTodayTasks(tasks.value));
const pendingNoDateTasks = computed(() => filterPendingTasks(noDateTasks.value));
const pendingEarlierTasks = computed(() => filterPendingTasks(earlierTasks.value));

// 首页统计口径：今日 + 无日期 + 逾期未过期，三者一起算
const countableTasks = computed(() =>
	[...tasks.value, ...noDateTasks.value, ...earlierTasks.value].filter(
		({ instance }) => instance.status !== "skipped",
	),
);

// 计算进度（基于合并后的任务列表）
const taskStats = computed(() => calculateTaskStats(countableTasks.value));

// 计算预估总积分和已获积分
const earnedPoints = computed(() => calculateTodayEarnedPoints(countableTasks.value));
const estimatedTotalPoints = computed(() =>
	calculateEstimatedTotalPoints(countableTasks.value),
);

const isLoading = computed(
	() => isUserLoading.value || isTasksLoading.value || isNoDateTasksLoading.value,
);
</script>

<template>
	<div class="pb-24 bg-background">
		<!-- Header -->
		<header class="px-4 pb-4">
			<HomeHeader :user="user" :current-points="currentPoints" />
			<div class="mb-2">
				<div class="flex items-center justify-between mb-2">
					<p class="text-text-primary text-base font-normal">
						You've completed {{ taskStats.completedCount }} of {{ taskStats.totalCount }} tasks.
					</p>
					<p class="text-base font-normal">
						<span class="text-white">{{ earnedPoints }}</span>
						<span class="text-text-secondary mx-1">/</span>
						<span class="text-primary">{{ estimatedTotalPoints }}</span>
					</p>
				</div>
				<RProgress :value="taskStats.completedCount" :max="taskStats.totalCount" />
			</div>
		</header>

		<!-- Tasks List -->
		<main class="px-4">
			<!-- 非今日但未过期（默认折叠，无则不渲染） -->
			<div v-if="pendingEarlierTasks.length > 0" class="mb-6">
				<TaskList
					:tasks="pendingEarlierTasks"
					:is-loading="isLoading"
					:title="'Carried Over'"
					:show-view-all="false"
					collapsible
					default-collapsed
					@task-click="handleTaskClick"
				/>
			</div>

			<TaskList
				:tasks="pendingTasks"
				:is-loading="isLoading"
				title="Today's Tasks"
				:show-view-all="true"
				:show-history="true"
				empty-message="No tasks for today"
				@task-click="handleTaskClick"
			/>

			<!-- No Date Tasks Section -->
			<div v-if="pendingNoDateTasks.length > 0" class="mt-6">
				<TaskList
					:tasks="pendingNoDateTasks"
					:is-loading="isLoading"
					title="No Date"
					:show-view-all="false"
					@task-click="handleTaskClick"
				/>
			</div>
		</main>

		<!-- Floating Add Button -->
		<button
			class="fixed bottom-24 right-4 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light transition-colors z-40"
			@click="router.push('/tasks/new')"
		>
			<Plus class="w-7 h-7" />
		</button>

		<!-- 任务详情 Popup -->
		<TaskDetailPopup
			:is-open="isDetailOpen"
			:instance="selectedTask?.instance ?? null"
			:template="selectedTask?.template ?? null"
			@close="handleCloseDetail"
			@complete="handleCompleteInPopup"
			@reset="handleResetInPopup"
			@toggle-subtask="handleToggleSubtask"
			@delete="handleDeleteInPopup"
			@increment-count="handleIncrementCount"
		/>
	</div>
</template>

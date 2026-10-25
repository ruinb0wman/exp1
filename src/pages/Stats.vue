<script setup lang="ts">
import { MobileCalendar } from "@ruinb0w/ui";
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { Plus } from "@lucide/vue";
import Header from "@/components/Header.vue";
import HeaderActionButton from "@/components/HeaderActionButton.vue";
import TaskInstanceCard from "@/components/TaskInstanceCard/index.vue";
import TaskDetailPopup from "@/components/TaskDetailPopup.vue";
import { useUserStore } from "@/store";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import { useTaskInstanceGenerator } from "@/composables/useTaskInstanceGenerator";
import { useTaskInstanceActions } from "@/composables/useTasks";
import { formatLocalDate } from "@/libs/task";
import {
	completeTaskInPopup,
	resetTaskInPopup,
	incrementTaskCount,
} from "@/pages/Home/lib";

interface DisplayTaskItem {
	template: TaskTemplate;
	instance?: TaskInstance;
	isPreview: boolean;
}

function isSameDay(date1: Date, date2: Date): boolean {
	return formatLocalDate(date1) === formatLocalDate(date2);
}

const router = useRouter();
const userStore = useUserStore();
const { user: currentUser } = storeToRefs(userStore);

const selectedDate = ref<Date | null>(new Date());
const tasks = ref<DisplayTaskItem[]>([]);
const isLoading = ref(false);

// 任务详情 popup 状态
const selectedTask = ref<{
	instance: TaskInstance;
	template: TaskTemplate;
} | null>(null);
const isDetailOpen = ref(false);

const { complete, reset, remove: deleteInstance } = useTaskInstanceActions();

const { getDisplayTasksForDate } = useTaskInstanceGenerator({
	userId: () => currentUser.value?.id,
});

// 加载指定日期的任务
async function loadTasksForDate(date: Date) {
	if (!currentUser.value) return;

	isLoading.value = true;
	try {
		// 使用 composable 获取该日期应该显示的任务（包含已有实例和预览）
		tasks.value = await getDisplayTasksForDate(date);
	} catch (error) {
		console.error("Failed to load tasks:", error);
		tasks.value = [];
	} finally {
		isLoading.value = false;
	}
}

// 当选择的日期变化时加载任务
watch(
	[selectedDate, currentUser],
	([date]) => {
		if (date && currentUser.value) void loadTasksForDate(date);
	},
	{ immediate: true },
);

const formattedSelectedDate = computed(() =>
	selectedDate.value
		? selectedDate.value.toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
			})
		: "Select a date",
);

const isSelectedToday = computed(() =>
	selectedDate.value ? isSameDay(selectedDate.value, new Date()) : false,
);

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

// 刷新任务列表
async function refreshTasks() {
	if (selectedDate.value) {
		await loadTasksForDate(selectedDate.value);
	}
}

const noopRefresh = async () => {};

// 在 popup 中删除任务实例（同时删除其积分记录）
async function handleDeleteInPopup() {
	if (!selectedTask.value) return;
	const { instance } = selectedTask.value;
	try {
		await deleteInstance(instance.id!);
		// 删除后刷新当前日期的任务列表（该模板会以预览形式重新出现）
		await refreshTasks();
		handleCloseDetail();
	} catch (error) {
		console.error("Failed to delete task instance:", error);
	}
}

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
			noopRefresh,
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
			noopRefresh,
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
			noopRefresh,
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

function handleCardClick(
	task: DisplayTaskItem,
	data: { template: TaskTemplate; instance?: TaskInstance },
) {
	if (data.instance && !task.isPreview) {
		handleTaskClick(data.instance, data.template);
	}
}

function handleDateChange(value: Date | [Date, Date] | null) {
	selectedDate.value = value instanceof Date ? value : null;
}

function monthLabel(date: Date) {
	return date.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
}
</script>

<template>
	<div class="min-h-screen pb-24 bg-background">
		<!-- Header -->
		<Header title="Calendar">
			<template #right>
				<HeaderActionButton
					side="end"
					label="Create Task"
					@click="router.push('/tasks/new')"
				>
					<Plus class="w-5 h-5" />
				</HeaderActionButton>
			</template>
		</Header>

		<main class="px-4">
			<!-- Calendar - 使用默认配置 -->
			<div class="mx-auto">
				<MobileCalendar
					mode="single"
					:model-value="selectedDate"
					:show-year-switcher="false"
					:week-starts-on="0"
					:week-day-labels="['S', 'M', 'T', 'W', 'T', 'F', 'S']"
					:month-label="monthLabel"
					@change="handleDateChange"
				/>
			</div>

			<!-- Tasks for the day -->
			<div class="mt-6">
				<div class="flex items-center justify-between pb-2 pt-4">
					<h3 class="text-lg font-bold text-text-primary">
						Tasks for {{ formattedSelectedDate }}
					</h3>
					<span
						v-if="!isSelectedToday && selectedDate"
						class="text-xs text-text-muted bg-surface px-2 py-1 rounded"
					>
						Preview
					</span>
				</div>

				<div v-if="isLoading" class="py-8 text-center text-text-muted">Loading...</div>

				<div v-else-if="tasks.length === 0" class="py-8 text-center text-text-muted">
					No tasks for this day
				</div>

				<div v-else class="space-y-3">
					<TaskInstanceCard
						v-for="task in tasks"
						:key="task.instance?.id ?? `preview-${task.template.id}`"
						:template="task.template"
						:instance="task.instance"
						:is-preview="task.isPreview"
						@click="(data) => handleCardClick(task, data)"
					/>
				</div>
			</div>
		</main>

		<!-- 任务详情 Popup -->
		<TaskDetailPopup
			:is-open="isDetailOpen"
			:instance="selectedTask?.instance ?? null"
			:template="selectedTask?.template ?? null"
			@close="handleCloseDetail"
			@complete="handleCompleteInPopup"
			@reset="handleResetInPopup"
			@increment-count="handleIncrementCount"
			@delete="handleDeleteInPopup"
		/>
	</div>
</template>

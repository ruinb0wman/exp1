<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { usePomoStore } from "@/store/pomoStore";
import { useUserStore } from "@/store/userStore";
import { useTodayTasks } from "@/composables/useTasks";
import { useConfirm } from "@/composables/useConfirm";
import PomoTimer from "@/components/PomoTimer.vue";
import PomoHeader from "./components/PomoHeader.vue";
import ModeSwitcher from "./components/ModeSwitcher.vue";
import TaskSelectorButton from "./components/TaskSelectorButton.vue";
import ControlButtons from "./components/ControlButtons.vue";
import TaskSelector from "./components/TaskSelector.vue";
import SettingsPopup from "./components/SettingsPopup.vue";

const userStore = useUserStore();
const userId = computed(() => userStore.user?.id ?? 1);

const pomoStore = usePomoStore();
const {
	mode,
	isRunning,
	isPaused,
	selectedTaskId,
	todayCount,
	settings,
} = storeToRefs(pomoStore);

const { tasks } = useTodayTasks(() => userId.value);

// 不用原生 window.confirm()：Android WebView 没实现 onJsConfirm，它直接返回 false
// （按钮会变成死的），在 Electron 里又会阻塞渲染进程。一律用应用内确认框。
const confirmDialog = useConfirm();

const showTaskSelector = ref(false);
const showSettings = ref(false);

// 加载设置和今日完成数
watch(
	userId,
	(id) => {
		if (id) {
			void pomoStore.loadSettings(id);
			void pomoStore.loadTodayCount(id);
		}
	},
	{ immediate: true },
);

onMounted(() => {
	if (userId.value) {
		void pomoStore.loadSettings(userId.value);
		void pomoStore.loadTodayCount(userId.value);
	}
});

// 获取选中的任务
const selectedTask = computed(() =>
	tasks.value.find((t) => t.instance.id === selectedTaskId.value),
);

// 放弃按钮
async function handleStop() {
	const ok = await confirmDialog({
		title: "Give Up",
		message: "Are you sure you want to give up the current timer?",
		confirmLabel: "Give Up",
		variant: "danger",
	});
	if (!ok) return;

	try {
		await pomoStore.stopTimer(false);
	} catch (error) {
		console.error("Failed to give up pomodoro session:", error);
	}
}

// 完成按钮（提前完成）
async function handleComplete() {
	const ok = await confirmDialog({
		title: "Complete Early",
		message: "Complete the current timer early?",
		confirmLabel: "Complete",
		variant: "info",
	});
	if (!ok) return;

	try {
		await pomoStore.stopTimer(true);
	} catch (error) {
		console.error("Failed to complete pomodoro session early:", error);
	}
}
</script>

<template>
	<div class="min-h-screen bg-background pb-24">
		<!-- 头部 -->
		<PomoHeader
			:today-count="todayCount"
			:sound-enabled="settings.soundEnabled"
			@toggle-sound="pomoStore.updateSettings({ soundEnabled: !settings.soundEnabled })"
			@open-settings="showSettings = true"
		/>

		<!-- 模式切换 -->
		<ModeSwitcher
			:current-mode="mode"
			:is-running="isRunning"
			@mode-change="(m) => pomoStore.setMode(m)"
		/>

		<!-- 计时器 -->
		<div class="flex justify-center mt-8">
			<PomoTimer />
		</div>

		<!-- 任务选择 -->
		<div class="px-4 mt-8">
			<TaskSelectorButton
				:selected-task="selectedTask"
				:disabled="isRunning"
				@click="showTaskSelector = true"
			/>
		</div>

		<!-- 控制按钮 -->
		<div class="px-4 mt-8">
			<ControlButtons
				:is-running="isRunning"
				:is-paused="isPaused"
				@start="() => void pomoStore.startTimer()"
				@pause="pomoStore.pauseTimer"
				@resume="pomoStore.resumeTimer"
				@reset="pomoStore.resetTimer"
				@stop="handleStop"
				@complete="handleComplete"
			/>
		</div>

		<!-- 任务选择弹窗 -->
		<TaskSelector
			:is-open="showTaskSelector"
			:tasks="tasks"
			:selected-task-id="selectedTaskId"
			@close="showTaskSelector = false"
			@select-task="(id) => pomoStore.setSelectedTask(id)"
		/>

		<!-- 设置弹窗 -->
		<SettingsPopup
			:is-open="showSettings"
			:settings="settings"
			@close="showSettings = false"
			@update-settings="(s) => void pomoStore.updateSettings(s)"
		/>
	</div>
</template>

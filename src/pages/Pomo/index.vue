<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { usePomoStore } from "@/store/pomoStore";
import { useUserStore } from "@/store/userStore";
import { useTodayTasks } from "@/composables/useTasks";
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
function handleStop() {
	if (confirm("Are you sure you want to give up the current timer?")) {
		void pomoStore.stopTimer(false);
	}
}

// 完成按钮（提前完成）
function handleComplete() {
	if (confirm("Complete the current timer early?")) {
		void pomoStore.stopTimer(true);
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

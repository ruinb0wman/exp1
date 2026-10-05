import { defineStore } from "pinia";
import { ref } from "vue";
import type { PomoMode, PomoSettings } from "@/db/types/pomo";
import { DEFAULT_POMO_SETTINGS } from "@/db/types/pomo";
import {
	createPomoSession,
	completePomoSession,
	abortPomoSession,
	incrementInterruptions,
	getTodayCompletedPomoCount,
} from "@/db/services/pomoService";
import {
	getUserPomoSettings,
	updateUserPomoSettings,
} from "@/db/services/userService";
import { addPomoToTaskProgress } from "@/db/services/taskService";
import { useUserStore } from "./userStore";

// 音频上下文（用于提示音）
let audioContext: AudioContext | null = null;

// 播放提示音
function playNotificationSound() {
	if (!audioContext) {
		audioContext = new (
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext
		)();
	}

	const oscillator = audioContext.createOscillator();
	const gainNode = audioContext.createGain();

	oscillator.connect(gainNode);
	gainNode.connect(audioContext.destination);

	oscillator.frequency.value = 800;
	oscillator.type = "sine";

	gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
	gainNode.gain.exponentialRampToValueAtTime(
		0.01,
		audioContext.currentTime + 0.5,
	);

	oscillator.start(audioContext.currentTime);
	oscillator.stop(audioContext.currentTime + 0.5);
}

// 根据模式获取时长(秒)
function getDurationForMode(mode: PomoMode, settings: PomoSettings): number {
	switch (mode) {
		case "focus":
			return settings.focusDuration * 60;
		case "shortBreak":
			return settings.shortBreakDuration * 60;
		case "longBreak":
			return settings.longBreakDuration * 60;
	}
}

const initialDuration = getDurationForMode("focus", DEFAULT_POMO_SETTINGS);

export const usePomoStore = defineStore("pomo", () => {
	// 当前状态
	const mode = ref<PomoMode>("focus");
	const timeLeft = ref(initialDuration); // 剩余秒数
	const totalTime = ref(initialDuration); // 当前模式总秒数
	const isRunning = ref(false);
	const isPaused = ref(false);
	const selectedTaskId = ref<string | null>(null);
	const todayCount = ref(0);
	const currentSessionId = ref<number | null>(null);
	const settings = ref<PomoSettings>(DEFAULT_POMO_SETTINGS);
	const isSettingsLoaded = ref(false); // 设置是否已加载

	// 切换模式
	function setMode(nextMode: PomoMode) {
		if (isRunning.value) return; // 运行中不允许切换

		const duration = getDurationForMode(nextMode, settings.value);
		mode.value = nextMode;
		timeLeft.value = duration;
		totalTime.value = duration;
		isPaused.value = false;
	}

	// 选择任务
	function setSelectedTask(taskId: string | null) {
		selectedTaskId.value = taskId;
	}

	// 更新设置
	async function updateSettings(newSettings: Partial<PomoSettings>) {
		const userStore = useUserStore();
		const userId = userStore.user?.id;

		const updated = { ...settings.value, ...newSettings };

		// 保存到数据库
		if (userId) {
			await updateUserPomoSettings(userId, newSettings);
		}

		settings.value = updated;

		// 如果不在运行中，更新当前倒计时
		if (!isRunning.value) {
			const duration = getDurationForMode(mode.value, updated);
			timeLeft.value = duration;
			totalTime.value = duration;
		}
	}

	// 开始计时
	async function startTimer() {
		const userStore = useUserStore();
		const userId = userStore.user?.id;

		if (!userId) return;

		// 创建数据库记录
		const sessionId = await createPomoSession({
			userId,
			taskId: selectedTaskId.value || undefined,
			mode: mode.value,
			duration: totalTime.value,
			actualDuration: 0,
			status: "running",
			interruptions: 0,
		});

		isRunning.value = true;
		isPaused.value = false;
		currentSessionId.value = sessionId;

		// 播放开始音效
		if (settings.value.soundEnabled) {
			playNotificationSound();
		}
	}

	// 暂停计时
	function pauseTimer() {
		if (currentSessionId.value) {
			incrementInterruptions(currentSessionId.value);
		}
		isPaused.value = true;
	}

	// 恢复计时
	function resumeTimer() {
		isPaused.value = false;
	}

	// 停止计时
	async function stopTimer(
		completed: boolean,
		actualDurationOverride?: number,
	) {
		const userStore = useUserStore();

		if (!currentSessionId.value) return;

		// 实际时长优先用后端给出的 elapsed：漏 tick（灭屏/被冻结）时用 totalTime - timeLeft 会算少
		const actualDuration =
			actualDurationOverride ?? totalTime.value - timeLeft.value;

		if (completed) {
			await completePomoSession(currentSessionId.value, actualDuration);

			// 专注完成
			if (mode.value === "focus") {
				const userId = userStore.user?.id;

				// 刷新今日计数
				if (userId) {
					const count = await getTodayCompletedPomoCount(userId);
					todayCount.value = count;
				}

				// 更新关联任务的进度（任务完成时积分会在 updateTaskProgress 中自动发放）
				if (selectedTaskId.value) {
					try {
						await addPomoToTaskProgress(
							selectedTaskId.value,
							actualDuration,
						);
					} catch (err) {
						// 任务可能已过期或不支持进度追踪，静默忽略
						console.log("更新任务进度失败:", err);
					}
				}
			}

			// 播放完成音效
			if (settings.value.soundEnabled) {
				playNotificationSound();
			}
		} else {
			await abortPomoSession(currentSessionId.value, actualDuration);
		}

		isRunning.value = false;
		isPaused.value = false;
		currentSessionId.value = null;
	}

	// 每秒滴答
	function tick() {
		if (!isRunning.value || isPaused.value) return;

		const newTimeLeft = timeLeft.value - 1;

		// 只更新倒计时，完成逻辑由全局计时器 composable 处理
		if (newTimeLeft >= 0) {
			timeLeft.value = newTimeLeft;
		}
	}

	// 加载今日完成数
	async function loadTodayCount(userId: number) {
		const count = await getTodayCompletedPomoCount(userId);
		todayCount.value = count;
	}

	// 重置计时器
	function resetTimer() {
		if (isRunning.value) return;

		const duration = getDurationForMode(mode.value, settings.value);
		timeLeft.value = duration;
		totalTime.value = duration;
		isPaused.value = false;
	}

	// 加载设置
	async function loadSettings(userId: number) {
		const loaded = await getUserPomoSettings(userId);

		settings.value = loaded;
		isSettingsLoaded.value = true;

		// 如果不在运行中，更新当前倒计时
		if (!isRunning.value) {
			const duration = getDurationForMode(mode.value, loaded);
			timeLeft.value = duration;
			totalTime.value = duration;
		}
	}

	return {
		mode,
		timeLeft,
		totalTime,
		isRunning,
		isPaused,
		selectedTaskId,
		todayCount,
		currentSessionId,
		settings,
		isSettingsLoaded,

		setMode,
		setSelectedTask,
		updateSettings,
		startTimer,
		pauseTimer,
		resumeTimer,
		stopTimer,
		tick,
		loadTodayCount,
		resetTimer,
		loadSettings,
	};
});

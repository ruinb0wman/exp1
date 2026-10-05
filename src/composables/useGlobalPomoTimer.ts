import { onMounted, onUnmounted, watch, watchEffect } from "vue";
import { storeToRefs } from "pinia";
import { usePomoStore } from "@/store/pomoStore";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
	requestPermission,
	isPermissionGranted,
} from "@tauri-apps/plugin-notification";
import { startService, stopService } from "tauri-plugin-background-service";

// 后端计时器数据类型
interface BackendTimerData {
	state: "idle" | "running" | "paused";
	mode: "focus" | "shortBreak" | "longBreak";
	timeLeft: number;
	totalTime: number;
	sessionId: number | null;
}

// 计时完成事件数据
interface PomoCompletedEvent {
	mode: "focus" | "shortBreak" | "longBreak";
	sessionId: number | null;
	/** 实际计时时长(秒)，由后端按截止时间戳给出（漏 tick 时也不会算少） */
	elapsed?: number;
}

// 格式化时间为 MM:SS 或 H:MM:SS
function formatTimeLabel(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	}
	return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * 全局番茄钟计时器 composable
 *
 * 使用 Tauri 后端计时器，确保即使窗口关闭（隐藏到托盘）也能继续计时和发送通知
 * Android 端通过 BackgroundService 实现前台服务保活 + 动态通知显示剩余时间
 */
export function useGlobalPomoTimer() {
	const pomoStore = usePomoStore();
	const {
		isRunning,
		isPaused,
		timeLeft,
		mode,
		settings,
		todayCount,
		currentSessionId,
		selectedTaskId,
	} = storeToRefs(pomoStore);

	// 保存最新状态快照，避免在回调闭包里读到旧值
	const state = {
		isRunning: isRunning.value,
		isPaused: isPaused.value,
		timeLeft: timeLeft.value,
		mode: mode.value,
		settings: settings.value,
		todayCount: todayCount.value,
		currentSessionId: currentSessionId.value,
		selectedTaskId: selectedTaskId.value,
	};

	watchEffect(() => {
		state.isRunning = isRunning.value;
		state.isPaused = isPaused.value;
		state.timeLeft = timeLeft.value;
		state.mode = mode.value;
		state.settings = settings.value;
		state.todayCount = todayCount.value;
		state.currentSessionId = currentSessionId.value;
		state.selectedTaskId = selectedTaskId.value;
	});

	// 用于防止重复处理完成事件
	let isCompleting = false;
	// 用于标记是否正在处理自动切换
	let isAutoSwitching = false;
	// 标记 Android 后台服务是否已启动
	let backgroundServiceStarted = false;

	// 启动 Android 后台服务（保活 + 通知）
	async function ensureBackgroundService(label: string) {
		if (backgroundServiceStarted) return;
		try {
			await startService({
				serviceLabel: label,
				// specialUse：语义正确，且避开 Android 15+ 对 dataSync「24h 内累计 6 小时」的上限
				foregroundServiceType: "specialUse",
			});
			backgroundServiceStarted = true;
		} catch (err) {
			// 非 Android 平台必然失败，属预期；但不再静默吞掉（静默失败正是「倒计时悄悄停掉」的成因之一）
			console.warn("启动后台服务失败（非 Android 平台可忽略）:", err);
		}
	}

	// 停止 Android 后台服务
	async function stopBackgroundService() {
		if (!backgroundServiceStarted) return;
		try {
			await stopService();
			backgroundServiceStarted = false;
		} catch (err) {
			console.warn("停止后台服务失败（非 Android 平台可忽略）:", err);
		}
	}

	// 处理计时完成
	async function handleTimerComplete(
		completedMode: "focus" | "shortBreak" | "longBreak",
		elapsedSeconds?: number,
	) {
		// 防止重复处理
		if (isCompleting) {
			console.log("计时完成处理中，跳过重复调用");
			return;
		}

		isCompleting = true;

		try {
			const currentSettings = state.settings;
			const currentTodayCount = state.todayCount;

			console.log("计时完成，处理中...", { completedMode, currentSettings });

			// 先标记自动切换，防止 sync effect 在 stopTimer 后误 stopService
			isAutoSwitching = true;

			// 先确保后端计时器已经停止
			try {
				await invoke("stop_pomo_timer");
				console.log("后端计时器已停止");
			} catch (err) {
				console.error("停止后端计时器失败:", err);
			}

			// 停止前端计时器（更新数据库等）
			await pomoStore.stopTimer(true, elapsedSeconds);
			console.log("前端计时器已停止");

			// 自动切换模式
			if (currentSettings.autoStartBreaks && completedMode === "focus") {
				const nextMode =
					currentTodayCount % currentSettings.longBreakInterval === 0
						? "longBreak"
						: "shortBreak";
				pomoStore.setMode(nextMode);

				if (currentSettings.autoStartPomos) {
					// 延迟启动新计时器，确保状态已经完全重置
					setTimeout(() => {
						pomoStore.startTimer().then(() => {
							isAutoSwitching = false;
						});
					}, 1000);
				} else {
					// 不自动开始，停止后台服务
					await stopBackgroundService();
					isAutoSwitching = false;
				}
			} else if (currentSettings.autoStartPomos && completedMode !== "focus") {
				pomoStore.setMode("focus");

				// 延迟启动新计时器
				setTimeout(() => {
					pomoStore.startTimer().then(() => {
						isAutoSwitching = false;
					});
				}, 1000);
			} else {
				// 不需要自动切换，停止后台服务
				await stopBackgroundService();
				isAutoSwitching = false;
			}
		} catch (err) {
			console.error("处理计时完成失败:", err);
			await stopBackgroundService();
			isAutoSwitching = false;
		} finally {
			// 延迟重置标志，确保所有异步操作完成
			setTimeout(() => {
				isCompleting = false;
			}, 2000);
		}
	}

	// 从后端拉取权威状态并同步到前端（冷启动恢复 / 页面重新可见时使用）
	async function pullBackendState(reason: string) {
		// 标记正在自动切换，防止 sync effect 干扰
		isAutoSwitching = true;

		try {
			const backendState =
				await invoke<BackendTimerData>("get_pomo_timer_state");

			if (backendState.state === "running" || backendState.state === "paused") {
				console.log(`${reason} - 同步后端计时器状态:`, backendState);
				// Android 端：后端在跑就确保后台服务已启动
				if (backendState.state === "running") {
					await ensureBackgroundService(
						`Pomodoro ${formatTimeLabel(backendState.timeLeft)}`,
					);
				}
				pomoStore.$patch({
					isRunning: true,
					isPaused: backendState.state === "paused",
					timeLeft: backendState.timeLeft,
					mode: backendState.mode,
				});
			} else if (backendState.state === "idle") {
				// 后端计时器已停止（到点或被取消），前端跟着收尾
				if (state.isRunning) {
					console.log(`${reason} - 后端计时器已停止，前端同步停止`);
					await pomoStore.stopTimer(false);
				}
			}
		} catch (err) {
			console.error(`${reason} - 检查后端状态失败:`, err);
		} finally {
			isAutoSwitching = false;
		}
	}

	// 请求通知权限
	onMounted(() => {
		void (async () => {
			try {
				const permissionGranted = await isPermissionGranted();
				if (!permissionGranted) {
					await requestPermission();
				}
			} catch (err) {
				console.error("请求通知权限失败:", err);
			}
		})();
	});

	// 监听后端事件
	onMounted(() => {
		let unlistenTick: UnlistenFn | null = null;
		let unlistenCompleted: UnlistenFn | null = null;
		let unlistenStateChanged: UnlistenFn | null = null;
		let unlistenNativeError: UnlistenFn | null = null;

		void (async () => {
			// 监听每秒 tick 事件
			unlistenTick = await listen<BackendTimerData>("pomo:tick", (event) => {
				const { timeLeft: backendTimeLeft } = event.payload;

				// 只有时间不一致时才更新，避免不必要的渲染
				if (backendTimeLeft !== state.timeLeft) {
					// 直接更新 store，不调用 tick() 避免重复减1
					pomoStore.$patch({ timeLeft: backendTimeLeft });
				}
			});

			// 监听计时完成事件
			unlistenCompleted = await listen<PomoCompletedEvent>(
				"pomo:completed",
				(event) => {
					console.log("收到计时完成事件:", event.payload);
					const { mode: completedMode, elapsed } = event.payload;
					void handleTimerComplete(completedMode, elapsed);
				},
			);

			// 原生能力（wake lock / 到点通知）调用失败时不再是静默的
			unlistenNativeError = await listen<string>(
				"pomo:native-error",
				(event) => {
					console.error("原生能力调用失败:", event.payload);
				},
			);

			// 监听状态变化事件
			unlistenStateChanged = await listen<BackendTimerData>(
				"pomo:state-changed",
				(event) => {
					const { state: backendTimerState, timeLeft: backendTimeLeft } =
						event.payload;

					// 同步状态到前端 store
					pomoStore.$patch({
						isRunning: backendTimerState === "running",
						isPaused: backendTimerState === "paused",
						timeLeft: backendTimeLeft,
					});
				},
			);
		})();

		onUnmounted(() => {
			if (unlistenTick) unlistenTick();
			if (unlistenCompleted) unlistenCompleted();
			if (unlistenStateChanged) unlistenStateChanged();
			if (unlistenNativeError) unlistenNativeError();
		});
	});

	// 同步前端状态到后端（当用户在前端操作时）
	// 注意：不依赖 timeLeft，避免后台 tick 事件触发频繁同步
	watch(
		[isRunning, isPaused, mode, currentSessionId, selectedTaskId],
		() => {
			// 如果正在自动切换模式，跳过同步
			if (isAutoSwitching) {
				console.log("正在自动切换模式，跳过同步");
				return;
			}

			void (async () => {
				try {
					// 获取后端当前状态
					const backendState =
						await invoke<BackendTimerData>("get_pomo_timer_state");

					// 如果前端正在运行但后端没有，启动后端计时器
					if (isRunning.value && !isPaused.value && backendState.state !== "running") {
						console.log("同步：启动后端计时器");
						// Android 端：先启动 BackgroundService 保活
						await ensureBackgroundService(
							`Pomodoro ${formatTimeLabel(timeLeft.value)}`,
						);
						await invoke("start_pomo_timer", {
							mode: mode.value,
							duration: timeLeft.value,
							sessionId: currentSessionId.value,
							taskId: selectedTaskId.value,
						});
					}
					// 如果前端暂停但后端在运行，暂停后端
					else if (isPaused.value && backendState.state === "running") {
						console.log("同步：暂停后端计时器");
						await invoke("pause_pomo_timer");
					}
					// 如果前端恢复但后端暂停，恢复后端
					else if (isRunning.value && !isPaused.value && backendState.state === "paused") {
						console.log("同步：恢复后端计时器");
						await invoke("resume_pomo_timer");
					}
					// 如果前端停止但后端在运行，停止后端
					else if (!isRunning.value && backendState.state !== "idle") {
						console.log("同步：停止后端计时器");
						await invoke("stop_pomo_timer");
						// Android 端：停止后台服务
						await stopBackgroundService();
					}
				} catch (err) {
					console.error("同步计时器状态失败:", err);
				}
			})();
		},
		{ immediate: true },
	);

	// 应用回到前台（切回应用 / 解锁亮屏）时主动拉一次权威快照。
	//
	// 说明：tauri 2.10 移动端没有可用的 resume 事件（旧的 `app:resumed` 监听的事件名不存在，从不触发）；
	// 倒计时本身已由后端按截止时间戳重算，这里只是让 UI 更快对齐。
	const handleVisibilityChange = () => {
		if (!document.hidden) {
			void pullBackendState("页面重新可见");
		}
	};

	onMounted(() => {
		// 冷启动 / 页面刷新：恢复后端计时器状态
		void pullBackendState("应用启动");
		document.addEventListener("visibilitychange", handleVisibilityChange);
	});

	onUnmounted(() => {
		document.removeEventListener("visibilitychange", handleVisibilityChange);
	});
}

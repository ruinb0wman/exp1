import { onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { useUserStore, useTaskStore } from "@/store";
import { usePomoStore } from "@/store/pomoStore";
import { useExpiredTaskChecker } from "@/composables/useExpiredTaskChecker";
import { useGlobalPomoTimer } from "@/composables/useGlobalPomoTimer";
import { useAchievementWatcher } from "@/composables/useAchievementWatcher";
import { abortStalePomoSessions } from "@/db/services/pomoService";
import { getDB } from "@/db";
import type { PomoMode } from "@/db/types/pomo";

/** 后端在启动时交回的「上次计时」记录（进程被系统杀掉后才有内容） */
interface PendingPomoCompletion {
	sessionId: number;
	taskId?: string | null;
	mode: string;
	totalTime: number;
	triggerAtMs: number;
	/** 已过点 = 那次番茄钟真的跑完了；false 表示中途被打断 */
	completed: boolean;
}

const POMO_MODES: PomoMode[] = ["focus", "shortBreak", "longBreak"];

export function useAppBootstrap() {
	const userStore = useUserStore();
	const taskStore = useTaskStore();
	const pomoStore = usePomoStore();
	const { user } = storeToRefs(userStore);

	const hasReconciledPomo = ref(false);

	const { checkExpiredTasks } = useExpiredTaskChecker({
		userId: () => user.value?.id,
	});

	useGlobalPomoTimer();
	useAchievementWatcher(() => user.value?.id);

	onMounted(() => {
		if (!user.value) {
			void userStore.initUser();
		}
	});

	watch(
		() => user.value?.id,
		(id) => {
			if (id) void checkExpiredTasks();
		},
		{ immediate: true },
	);

	watch(
		() => user.value?.id,
		(id) => {
			if (id) {
				taskStore.subscribeToTodayTasks(id);
				taskStore.subscribeToNoDateTasks(id);
			}
		},
		{ immediate: true },
	);

	/**
	 * 番茄钟会话对账（只跑一次）：
	 *
	 * ① 先补记「离开期间到点、但进程被系统杀掉」的那次计时。原生侧在设到点闹钟时就把
	 *    (sessionId, mode, totalTime, triggerAtMs) 落盘了，这里取出来比对时间戳，
	 *    走一遍与正常完成相同的收尾流程（会话置 completed、今日计数、任务进度、积分）。
	 * ② 剩下的 running/paused 才真的是残留（进程被杀），按 aborted 收尾。
	 *
	 * 顺序不能反：反过来会把①的那条会话先废弃掉。
	 */
	watch(
		() => user.value?.id,
		(id) => {
			if (!id || hasReconciledPomo.value) return;
			hasReconciledPomo.value = true;

			void (async () => {
				try {
					const pending = await invoke<PendingPomoCompletion | null>(
						"take_pending_pomo_completion",
					);
					// 只在「已经过点」且会话确实还没结算时才补记
					// （防止页面刷新 / 正好在到点时强杀应用造成重复计入任务进度）
					const session =
						pending && pending.completed && pending.sessionId > 0
							? await getDB().pomoSessions.get(pending.sessionId)
							: undefined;
					if (
						pending &&
						pending.completed &&
						pending.sessionId > 0 &&
						session &&
						(session.status === "running" || session.status === "paused")
					) {
						console.log("补记离开期间完成的番茄钟:", pending);
						pomoStore.$patch({
							currentSessionId: pending.sessionId,
							mode: POMO_MODES.includes(pending.mode as PomoMode)
								? (pending.mode as PomoMode)
								: "focus",
							selectedTaskId: pending.taskId ?? null,
							totalTime: pending.totalTime,
							timeLeft: 0,
							isRunning: true,
							isPaused: false,
						});
						await pomoStore.stopTimer(true, pending.totalTime);
					}
				} catch (err) {
					console.error("补记番茄钟完成记录失败:", err);
				}

				try {
					const count = await abortStalePomoSessions();
					if (count > 0) console.log(`已收尾 ${count} 条残留的番茄钟会话`);
				} catch (err) {
					console.error("收尾残留番茄钟会话失败:", err);
				}
			})();
		},
		{ immediate: true },
	);
}

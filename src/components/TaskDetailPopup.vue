<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { useRouter } from "vue-router";
import {
	AlignLeft,
	Calendar,
	CheckCircle2,
	Clock,
	ChevronRight,
	CheckSquare,
	Layers,
	Pencil,
	RefreshCw,
	Square,
	Timer,
	Trash2,
	XCircle,
} from "@lucide/vue";
import { RModal } from "@ruinb0w/ui";
import TaskContributionGraph from "./TaskContributionGraph.vue";
import { useConfirm } from "@ruinb0w/ui";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import {
	isExpiredByInstanceDate,
	getExpireTimeTextByInstanceDate,
	type ExpireTimeResult,
} from "@/libs/time";
import {
	getTaskProgressPercent,
	getNextStage,
	getTotalPointsEarned,
} from "@/db/services";
import { calculateMaxPoints } from "@/db/types";
import { useUserStore } from "@/store";
import { usePomoStore } from "@/store/pomoStore";

const props = withDefaults(
	defineProps<{
		isOpen: boolean;
		instance: TaskInstance | null;
		template: TaskTemplate | null;
		isLoading?: boolean;
		disabled?: boolean;
	}>(),
	{
		isLoading: false,
		disabled: false,
	},
);

defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
	close: [];
	complete: [];
	reset: [];
	toggleSubtask: [index: number];
}>();

// onDelete / onIncrementCount 是可选的：从 attrs 里判断父组件是否传了
// inheritAttrs: false 避免把这些监听器透传到 Popup 的根元素上
const attrs = useAttrs();
const hasDelete = computed(() => typeof attrs.onDelete === "function");
const hasIncrement = computed(() => typeof attrs.onIncrementCount === "function");

const router = useRouter();
const confirmDialog = useConfirm();
const userStore = useUserStore();
const pomoStore = usePomoStore();

const isDeleting = computed(() => false);

const busy = computed(() => props.isLoading || isDeleting.value);

/** 周重复的星期缩写（下标 = Date.getDay()） */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function handleEdit() {
	emit("close");
	if (props.template?.id) {
		router.push(`/tasks/${props.template.id}`);
	}
}

// 删除实例前确认，确认后交由页面执行删除逻辑
async function handleDelete() {
	if (!props.template) return;

	const confirmed = await confirmDialog({
		title: "Delete",
		message:
			"Delete this task instance? Its points records will also be removed. It will be regenerated with the latest template on your next page visit.",
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		variant: "danger",
	});

	if (!confirmed) return;

	(attrs.onDelete as (() => void) | undefined)?.();
}

// ==================== 详情内容 ====================

const dayEndTime = computed(() => userStore.user?.dayEndTime ?? "00:00");
const expireDays = computed(() => props.template?.completeExpireDays);
const isExpired = computed(() =>
	expireDays.value && expireDays.value > 0 && props.instance
		? isExpiredByInstanceDate(
				props.instance.instanceDate,
				expireDays.value,
				dayEndTime.value,
			)
		: false,
);
const expireTimeResult = computed<ExpireTimeResult | null>(() =>
	expireDays.value && expireDays.value > 0 && props.instance
		? getExpireTimeTextByInstanceDate(
				props.instance.instanceDate,
				expireDays.value,
				dayEndTime.value,
			)
		: null,
);

const isCompleted = computed(() => props.instance?.status === "completed");
const rule = computed(() => props.template?.completeRule);
const isSimpleRule = computed(() => rule.value?.type === "simple");
const hasCompleteRule = computed(() => !!rule.value && !isSimpleRule.value);
const progressPercent = computed(() =>
	props.instance ? getTaskProgressPercent(props.instance) : 0,
);

const earnedPoints = computed(() => {
	if (!props.instance) return 0;
	if (isSimpleRule.value) {
		const r = rule.value;
		return isCompleted.value && r && r.type === "simple"
			? r.completionPoints
			: 0;
	}
	return getTotalPointsEarned(props.instance);
});

const expectedPoints = computed(() => {
	const r = rule.value;
	if (!r) return 0;
	if (r.type === "simple") return r.completionPoints;
	return hasCompleteRule.value ? calculateMaxPoints(r) : 0;
});

const isCountRule = computed(() => rule.value?.type === "count");
const isTimeRule = computed(() => rule.value?.type === "time");
const isSubtaskRule = computed(() => rule.value?.type === "subtask");

function getProgressText(): string | null {
	if (!hasCompleteRule.value) return null;
	const r = rule.value;
	if (!r || !props.instance) return null;

	if (isSubtaskRule.value && r.type === "subtask") {
		const completedCount = (props.instance.completedSubtasks || []).filter(
			Boolean,
		).length;
		const config = r.subtaskConfig;
		const targetCount =
			config?.mode === "all"
				? props.instance.subtasks.length
				: config?.requiredCount || 1;
		return `${completedCount}/${targetCount} items`;
	}

	const progress = props.instance.completeProgress ?? 0;
	const maxThreshold =
		"stages" in r && r.stages.length
			? Math.max(...r.stages.map((s) => s.threshold))
			: 0;
	const unit = r.type === "time" ? "min" : "times";
	return `${progress}/${maxThreshold} ${unit}`;
}

function getNextStageHint(): string | null {
	const r = rule.value;
	if (!r || isSubtaskRule.value || !props.instance) return null;

	const nextStage = getNextStage(props.instance);
	if (!nextStage) return null;

	const progress = props.instance.completeProgress ?? 0;
	const remaining = nextStage.threshold - progress;
	const unit = r.type === "time" ? "min" : "times";

	return `${remaining} more ${unit} to earn +${nextStage.points} exp`;
}

function getRepeatText(): string {
	const template = props.template;
	if (!template) return "";
	switch (template.repeatMode) {
		case "daily":
			return template.repeatInterval && template.repeatInterval > 1
				? `Daily (${template.repeatInterval})`
				: "Daily";
		case "weekly":
			if (template.repeatDaysOfWeek && template.repeatDaysOfWeek.length > 0) {
				const dayNames = template.repeatDaysOfWeek
					.map((d) => DAY_NAMES[d])
					.join(", ");
				return template.repeatInterval && template.repeatInterval > 1
					? `Weekly (${template.repeatInterval}) ${dayNames}`
					: `Weekly ${dayNames}`;
			}
			return "Weekly";
		case "monthly":
			if (template.repeatDaysOfMonth && template.repeatDaysOfMonth.length > 0) {
				const days = template.repeatDaysOfMonth.map((d) => `${d}`).join(", ");
				return template.repeatInterval && template.repeatInterval > 1
					? `Monthly (${template.repeatInterval}) ${days}`
					: `Monthly ${days}`;
			}
			return "Monthly";
		default:
			return "One-time";
	}
}

function renderExpireTime(result: ExpireTimeResult): string {
	switch (result.type) {
		case "expired":
			return "Expired";
		case "expiresInDays":
			return `Expires in ${result.value} days`;
		case "expiresInHours": {
			const hoursText = `Expires in ${result.hours} hours`;
			const minsText = result.minutes > 0 ? ` ${result.minutes} min` : "";
			return hoursText + minsText;
		}
		case "expiresInMinutes":
			return `Expires in ${result.value} minutes`;
	}
	return "";
}

const statusText = computed(() => {
	if (isCompleted.value) return "Completed";
	if (isExpired.value) return "Expired";
	return "In Progress";
});

const subtaskItems = computed(() => {
	if (!isSubtaskRule.value || !props.instance) return [];
	const completedSubtasks = props.instance.completedSubtasks || [];
	const r = rule.value;
	const pointsPerSubtask =
		r && r.type === "subtask" ? r.subtaskConfig?.pointsPerSubtask || [] : [];
	return props.instance.subtasks.map((subtask, index) => ({
		subtask,
		index,
		isCompleted: Boolean(completedSubtasks[index]),
		points: pointsPerSubtask[index] || 0,
	}));
});

function handleToggleSubtask(index: number) {
	if (isExpired.value || props.disabled || props.isLoading) return;
	emit("toggleSubtask", index);
}

function handleUsePomodoro() {
	if (!props.instance) return;
	pomoStore.setSelectedTask(props.instance.id!);
	// tab 页用 replace：返回手势直接退出，不会退回 Home
	router.replace("/pomo");
}

function handleIncrement() {
	(attrs.onIncrementCount as (() => void) | undefined)?.();
}

const instanceDateText = computed(() =>
	props.instance?.instanceDate
		? new Date(props.instance.instanceDate).toLocaleDateString()
		: null,
);
</script>

<template>
	<RModal
		:visible="isOpen"
		direction="bottom"
		title="Task Detail"
		:close-on-overlay="true"
		max-height="80vh"
		@close="emit('close')"
	>
		<template #header-right>
			<div class="flex items-center gap-1">
				<button
					v-if="hasDelete"
					:disabled="busy"
					class="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					title="Delete"
					@click="handleDelete"
				>
					<Trash2 class="w-3.5 h-3.5" />
					<span>Delete</span>
				</button>
				<button
					:disabled="busy"
					class="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					title="Edit Task"
					@click="handleEdit"
				>
					<Pencil class="w-3.5 h-3.5" />
					<span>Edit</span>
				</button>
			</div>
		</template>

		<div v-if="instance && template" class="space-y-4 py-2">
			<div class="flex items-start gap-3">
				<div
					:class="`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
						isCompleted ? 'bg-green-500/20' : isExpired ? 'bg-red-500/20' : 'bg-primary/20'
					}`"
				>
					<CheckCircle2 v-if="isCompleted" class="w-5 h-5 text-green-500" />
					<XCircle v-else-if="isExpired" class="w-5 h-5 text-red-500" />
					<Clock v-else class="w-5 h-5 text-primary" />
				</div>
				<div class="flex-1">
					<h3
						:class="`text-lg font-semibold ${isCompleted ? 'text-text-secondary line-through' : 'text-text-primary'}`"
					>
						{{ template.title }}
					</h3>
					<p class="text-sm text-text-secondary mt-1">{{ statusText }}</p>
				</div>
				<div class="text-right flex flex-col items-end gap-2">
					<span class="text-lg font-bold text-primary">
						+{{ earnedPoints
						}}<span v-if="expectedPoints > 0" class="text-sm text-text-muted font-normal">/{{ expectedPoints }}</span>
					</span>
					<p class="text-xs text-text-muted">exp</p>
				</div>
			</div>

			<div class="h-px bg-border" />

			<div class="space-y-3">
				<div v-if="template.description" class="flex items-start gap-3">
					<AlignLeft class="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
					<div>
						<p class="text-xs text-text-muted">Description</p>
						<p class="text-sm text-text-primary mt-0.5">{{ template.description }}</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<Layers class="w-4 h-4 text-text-muted shrink-0" />
					<div>
						<p class="text-xs text-text-muted">Level</p>
						<p class="text-sm text-text-primary mt-0.5">L{{ template.level }}</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<RefreshCw class="w-4 h-4 text-text-muted shrink-0" />
					<div>
						<p class="text-xs text-text-muted">Repeat</p>
						<p class="text-sm text-text-primary mt-0.5">{{ getRepeatText() }}</p>
					</div>
				</div>

				<div v-if="instance.instanceDate && instanceDateText" class="flex items-center gap-3">
					<Calendar class="w-4 h-4 text-text-muted shrink-0" />
					<div>
						<p class="text-xs text-text-muted">Date</p>
						<p class="text-sm text-text-primary mt-0.5">{{ instanceDateText }}</p>
					</div>
				</div>
			</div>

			<div v-if="hasCompleteRule" class="bg-surface rounded-xl p-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-text-secondary">Progress</span>
					<span class="text-sm font-medium text-primary">{{ getProgressText() }}</span>
				</div>
				<div class="h-2 bg-surface-light rounded-full overflow-hidden">
					<div
						:class="`h-full transition-all duration-300 ${
							progressPercent >= 100
								? 'bg-green-500'
								: progressPercent >= 60
									? 'bg-primary'
									: 'bg-yellow-500'
						}`"
						:style="{ width: `${Math.min(progressPercent, 100)}%` }"
					/>
				</div>
				<p
					v-if="!isCompleted && !isExpired && getNextStageHint()"
					class="text-xs text-text-muted mt-2"
				>
					{{ getNextStageHint() }}
				</p>
			</div>

			<TaskContributionGraph
				v-if="template.repeatMode !== 'none'"
				:template="template"
				:user-id="instance.userId"
			/>

			<div v-if="isExpired" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
				<p class="text-sm text-red-500 flex items-center gap-2">
					<XCircle class="w-4 h-4" />
					This task has expired
				</p>
			</div>
			<div v-else-if="expireTimeResult" class="bg-surface rounded-lg p-3">
				<p class="text-xs text-text-muted">{{ renderExpireTime(expireTimeResult) }}</p>
			</div>

			<!-- 子任务清单 -->
			<div v-if="subtaskItems.length > 0" class="bg-surface rounded-lg p-3 space-y-2">
				<p class="text-xs text-text-muted mb-2">Subtasks</p>
				<button
					v-for="item in subtaskItems"
					:key="item.index"
					:disabled="isExpired || disabled || isLoading"
					:class="`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
						item.isCompleted ? 'bg-green-500/10' : 'bg-surface-light hover:bg-surface-light/80'
					} ${isExpired || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`"
					@click="handleToggleSubtask(item.index)"
				>
					<CheckSquare v-if="item.isCompleted" class="w-5 h-5 text-green-500 shrink-0" />
					<Square v-else class="w-5 h-5 text-text-muted shrink-0" />
					<span
						:class="`flex-1 text-sm text-left ${
							item.isCompleted ? 'line-through text-text-muted' : 'text-text-primary'
						}`"
					>
						{{ item.subtask }}
					</span>
					<span
						v-if="item.points > 0"
						:class="`text-xs ${item.isCompleted ? 'text-green-500' : 'text-text-muted'}`"
					>
						+{{ item.points }}
					</span>
				</button>
			</div>

			<div class="flex gap-3 pt-2">
				<button
					v-if="isCompleted"
					:disabled="disabled || isLoading"
					class="flex-1 py-3 px-4 bg-surface hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-xl font-medium transition-colors"
					@click="emit('reset')"
				>
					{{ isLoading ? "Processing..." : "Mark as Incomplete" }}
				</button>
				<button
					v-else-if="isTimeRule"
					:disabled="isExpired || disabled || isLoading"
					class="flex-1 py-3 px-4 bg-surface hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
					@click="handleUsePomodoro"
				>
					<Timer class="w-4 h-4" />
					<span>{{ isLoading ? "Processing..." : isExpired ? "Expired" : "Use Pomodoro" }}</span>
					<ChevronRight class="w-4 h-4" />
				</button>
				<button
					v-else-if="isCountRule && hasIncrement"
					:disabled="isExpired || disabled || isLoading"
					class="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
					@click="handleIncrement"
				>
					{{ isLoading ? "Processing..." : isExpired ? "Expired" : "Complete One" }}
				</button>
				<div
					v-else-if="isSubtaskRule"
					class="flex-1 py-3 px-4 bg-surface rounded-xl text-center"
				>
					<p class="text-sm text-text-secondary">Click subtasks above to complete</p>
				</div>
				<button
					v-else
					:disabled="isExpired || disabled || isLoading"
					class="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
					@click="emit('complete')"
				>
					{{ isLoading ? "Processing..." : isExpired ? "Expired" : "Complete Task" }}
				</button>
				<button
					:disabled="isLoading"
					class="py-3 px-6 bg-surface hover:bg-surface-light disabled:opacity-50 text-text-secondary rounded-xl font-medium transition-colors"
					@click="emit('close')"
				>
					Close
				</button>
			</div>
		</div>

		<div v-else class="py-8 text-center text-text-secondary">Loading...</div>
	</RModal>
</template>

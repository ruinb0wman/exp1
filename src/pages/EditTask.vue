<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import Header from "@/components/Header.vue";
import RadioGroup from "@/components/RadioGroup.vue";
import MultiSelectGrid from "@/components/MultiSelectGrid.vue";
import DatePicker from "@/components/DatePicker.vue";
import NumberInput from "@/components/NumberInput.vue";
import { Loader2, Plus, Trash2 } from "lucide-vue-next";
import { useUserStore } from "@/store";
import { useTaskTemplate, useTaskTemplateActions } from "@/composables/useTasks";
import type {
	TaskTemplate,
	RepeatMode,
	EndCondition,
	CompleteRule,
	Stage,
	SubtaskConfig,
	TaskType,
} from "@/db/types/task";
import { toLocalDateString } from "@/libs/time";
import { toPlain } from "@/libs/plain";
import { useAlert } from "@/composables/useConfirm";

const repeatOptions = ["None", "Daily", "Weekly", "Monthly"];
const repeatValues: RepeatMode[] = ["none", "daily", "weekly", "monthly"];

const endOptions = ["Manual", "On Date", "After Times"];
const endValues: EndCondition[] = ["manual", "date", "times"];

const taskTypeOptions = ["Simple", "Time", "Count", "Subtask"];
const taskTypeValues: TaskType[] = ["simple", "time", "count", "subtask"];

const weekDays = [
	{ label: "Sun", value: 0 },
	{ label: "Mon", value: 1 },
	{ label: "Tue", value: 2 },
	{ label: "Wed", value: 3 },
	{ label: "Thu", value: 4 },
	{ label: "Fri", value: 5 },
	{ label: "Sat", value: 6 },
];

const monthDays = Array.from({ length: 31 }, (_, i) => ({
	label: String(i + 1),
	value: i + 1,
}));

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const id = computed(() => {
	const raw = route.params.id;
	return typeof raw === "string" ? raw : undefined;
});
const isEditMode = computed(() => Boolean(id.value && id.value !== "new"));
const templateId = computed(() => (isEditMode.value ? id.value! : null));

const {
	template: existingTemplate,
	isLoading: isLoadingTemplate,
	error: loadError,
} = useTaskTemplate(() => templateId.value);

const {
	create,
	update,
	isLoading: isSubmitting,
} = useTaskTemplateActions();

// 不用原生 alert()：Android WebView 会静默丢弃、Electron 里会阻塞渲染进程
const alertDialog = useAlert();

// 表单状态
const title = ref("");
const description = ref("");
const repeatIndex = ref(0);
const repeatInterval = ref(1);
const repeatDaysOfWeek = ref<number[]>([]);
const repeatDaysOfMonth = ref<number[]>([]);
const endIndex = ref(0);
const endValue = ref("");
const enabled = ref(true);
const level = ref(1);
const subtasks = ref<string[]>([]);
const newSubtask = ref("");

// 完成规则相关状态（新系统）
const taskType = ref<TaskType>("simple");
const stages = ref<Stage[]>([]);
const completionPoints = ref(0);
const completeExpireDays = ref<number>(0);

// 子任务配置
const subtaskMode = ref<SubtaskConfig["mode"]>("all");
const requiredCount = ref(1);
const pointsPerSubtask = ref<number[]>([]);

// 开始时间
const startAt = ref<string>("");
const isScheduleEnabled = ref(false);

function formatToDateStr(dateStr: string | undefined): string {
	if (!dateStr) return "";
	return toLocalDateString(dateStr);
}

// 加载现有数据（编辑模式）
watch(
	existingTemplate,
	(template) => {
		if (!template) return;

		title.value = template.title;
		description.value = template.description ?? "";
		repeatIndex.value = repeatValues.indexOf(template.repeatMode);
		repeatInterval.value = template.repeatInterval ?? 1;
		repeatDaysOfWeek.value = template.repeatDaysOfWeek ?? [];
		repeatDaysOfMonth.value = template.repeatDaysOfMonth ?? [];
		endIndex.value = endValues.indexOf(template.endCondition);

		endValue.value = formatToDateStr(template.endValue);
		enabled.value = template.enabled;
		level.value =
			template.level && template.level > 0 ? template.level : 1;
		subtasks.value = template.subtasks ?? [];

		// 加载新的完成规则
		const rule = template.completeRule;
		if (rule) {
			taskType.value = rule.type;
			stages.value = rule.stages || [];
			completionPoints.value = rule.completionPoints || 0;

			if (rule.type === "subtask" && rule.subtaskConfig) {
				subtaskMode.value = rule.subtaskConfig.mode;
				requiredCount.value = rule.subtaskConfig.requiredCount || 1;
				pointsPerSubtask.value = rule.subtaskConfig.pointsPerSubtask || [];
			}
		} else {
			// 旧数据兼容：没有 completeRule 的视为 simple 任务
			taskType.value = "simple";
			stages.value = [];
			completionPoints.value = 0;
		}

		completeExpireDays.value = template.completeExpireDays ?? 0;
		startAt.value = formatToDateStr(template.startAt);
		isScheduleEnabled.value = !!template.startAt;
	},
	{ immediate: true },
);

// 当子任务数量变化时，同步 pointsPerSubtask 长度
watch(
	() => subtasks.value.length,
	(length) => {
		const next = [...pointsPerSubtask.value];
		while (next.length < length) next.push(0);
		pointsPerSubtask.value = next.slice(0, length);
	},
);

function handleAddSubtask() {
	if (newSubtask.value.trim()) {
		subtasks.value = [...subtasks.value, newSubtask.value.trim()];
		newSubtask.value = "";
	}
}

function handleDeleteSubtask(index: number) {
	subtasks.value = subtasks.value.filter((_, i) => i !== index);
	pointsPerSubtask.value = pointsPerSubtask.value.filter((_, i) => i !== index);
}

function handleWeekDayChange(day: number) {
	repeatDaysOfWeek.value = repeatDaysOfWeek.value.includes(day)
		? repeatDaysOfWeek.value.filter((d) => d !== day)
		: [...repeatDaysOfWeek.value, day].sort((a, b) => a - b);
}

function handleMonthDayChange(day: number) {
	repeatDaysOfMonth.value = repeatDaysOfMonth.value.includes(day)
		? repeatDaysOfMonth.value.filter((d) => d !== day)
		: [...repeatDaysOfMonth.value, day].sort((a, b) => a - b);
}

// 阶段管理
function addStage() {
	const lastStage = stages.value[stages.value.length - 1];
	const newThreshold = lastStage
		? lastStage.threshold + (taskType.value === "time" ? 5 : 1)
		: taskType.value === "time"
			? 5
			: 1;

	stages.value = [
		...stages.value,
		{
			id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			threshold: newThreshold,
			points: 1,
		},
	];
}

function updateStage(index: number, field: keyof Stage, value: number) {
	const next = [...stages.value];
	next[index] = { ...next[index], [field]: value };
	stages.value = next;
}

function removeStage(index: number) {
	stages.value = stages.value.filter((_, i) => i !== index);
}

async function handleSubmit() {
	if (!user.value?.id) {
		await alertDialog({ title: "Error", message: "User not initialized", confirmLabel: "OK" });
		return;
	}

	// 日历日字段（startAt/日期型 endValue）存本地日期串 YYYY-MM-DD；绝对时刻（createdAt 等）存 UTC ISO

	// 构建 CompleteRule
	// simple 任务也需要 completeRule，type 为 'simple'
	const completeRule: CompleteRule =
		taskType.value === "subtask"
			? {
					type: "subtask",
					stages: [],
					completionPoints: completionPoints.value,
					subtaskConfig: {
						mode: subtaskMode.value,
						requiredCount:
							subtaskMode.value === "partial" ? requiredCount.value : undefined,
						pointsPerSubtask: pointsPerSubtask.value,
					},
				}
			: taskType.value === "simple"
				? {
						type: "simple",
						stages: [],
						completionPoints: completionPoints.value,
					}
				: {
						type: taskType.value,
						stages: stages.value,
						completionPoints: completionPoints.value,
					};

	const taskData: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt"> = toPlain({
		userId: user.value.id,
		title: title.value,
		description: description.value || undefined,

		level: level.value,

		repeatMode: repeatValues[repeatIndex.value],
		repeatInterval:
			repeatValues[repeatIndex.value] !== "none"
				? repeatInterval.value
				: undefined,
		repeatDaysOfWeek:
			repeatValues[repeatIndex.value] === "weekly"
				? repeatDaysOfWeek.value
				: undefined,
		repeatDaysOfMonth:
			repeatValues[repeatIndex.value] === "monthly"
				? repeatDaysOfMonth.value
				: undefined,
		endCondition: endValues[endIndex.value],
		endValue: endValues[endIndex.value] !== "manual" ? endValue.value : undefined,
		enabled: enabled.value,
		subtasks: subtasks.value,
		completeRule,
		completeTarget: undefined, // 旧字段，不再使用
		completeExpireDays:
			completeExpireDays.value > 0 ? completeExpireDays.value : undefined,
		startAt: isScheduleEnabled.value ? startAt.value : undefined,
	});

	try {
		if (isEditMode.value && templateId.value) {
			await update(templateId.value, taskData);
		} else {
			await create(taskData);
		}
		router.back();
	} catch (error) {
		console.error("Failed to save task:", error);
		await alertDialog({
			title: "Save Failed",
			message:
				error instanceof Error ? error.message : "Failed to save task",
			confirmLabel: "OK",
		});
	}
}

const repeatMode = computed(() => repeatValues[repeatIndex.value]);
const endCondition = computed(() => endValues[endIndex.value]);
const taskTypeIndex = computed(() => taskTypeValues.indexOf(taskType.value));

// 日期串 <-> Date
const startAtDate = computed<Date | null>(() => {
	if (!startAt.value) return null;
	const [year, month, day] = startAt.value.split("-").map(Number);
	return new Date(year, month - 1, day);
});

function dateToStr(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function handleStartAtChange(date: Date | null) {
	if (!date) {
		startAt.value = "";
		completeExpireDays.value = 0;
		return;
	}
	startAt.value = dateToStr(date);
}

function handleEndValueChange(date: Date | null) {
	if (!date) {
		endValue.value = "";
		return;
	}
	endValue.value = dateToStr(date);
}

const endValueDate = computed<Date | null>(() => {
	if (!endValue.value) return null;
	const [year, month, day] = endValue.value.split("-").map(Number);
	return new Date(year, month - 1, day);
});

const minToday = new Date();

function handleTaskTypeChange(index: number) {
	const newType = taskTypeValues[index];
	taskType.value = newType;
	if (
		newType !== "simple" &&
		newType !== "subtask" &&
		stages.value.length === 0
	) {
		// 自动添加一个默认阶段
		addStage();
	}
}

function handleScheduleToggle() {
	const next = !isScheduleEnabled.value;
	isScheduleEnabled.value = next;
	if (next) {
		startAt.value = dateToStr(new Date());
	} else {
		startAt.value = "";
		completeExpireDays.value = 0;
		repeatIndex.value = 0;
	}
}

// 积分预览
const maxPointsForStages = computed(
	() =>
		stages.value.reduce((sum, s) => sum + s.points, 0) + completionPoints.value,
);

const maxPointsForSubtasks = computed(() => {
	if (subtaskMode.value === "all") {
		return (
			pointsPerSubtask.value.reduce((sum, p) => sum + (p || 0), 0) +
			completionPoints.value
		);
	}
	return (
		[...pointsPerSubtask.value]
			.sort((a, b) => (b || 0) - (a || 0))
			.slice(0, requiredCount.value)
			.reduce((sum, p) => sum + (p || 0), 0) + completionPoints.value
	);
});
</script>

<template>
	<!-- 加载中状态 -->
	<div
		v-if="isEditMode && isLoadingTemplate"
		class="min-h-screen bg-background flex items-center justify-center"
	>
		<div class="flex flex-col items-center gap-4 text-text-muted">
			<Loader2 class="w-8 h-8 animate-spin" />
			<p>Loading task...</p>
		</div>
	</div>

	<!-- 加载错误 -->
	<div
		v-else-if="isEditMode && loadError"
		class="min-h-screen bg-background flex items-center justify-center"
	>
		<div class="flex flex-col items-center gap-4 text-text-muted">
			<p>Failed to load task</p>
			<button class="text-primary hover:text-primary-light" @click="router.push('/tasks')">
				Go Back
			</button>
		</div>
	</div>

	<div v-else class="min-h-screen bg-background">
		<Header :title="isEditMode ? 'Edit Task' : 'Create Task'" back />

		<main class="flex-1 px-4 py-6 space-y-6">
			<!-- Main Task Details Card -->
			<div class="space-y-4 rounded-xl bg-surface p-4">
				<label class="flex flex-col flex-1">
					<p class="text-text-primary text-base font-medium leading-normal pb-2">
						Task Name
					</p>
					<input
						v-model="title"
						type="text"
						placeholder="e.g., Read for 30 minutes"
						class="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light h-14 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
					/>
				</label>

				<label class="flex flex-col flex-1">
					<p class="text-text-primary text-base font-medium leading-normal pb-2">
						Description (optional)
					</p>
					<textarea
						v-model="description"
						placeholder="e.g., Finish 'Atomic Habits'"
						class="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light min-h-24 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
					/>
				</label>

				<!-- Level -->
				<div class="flex items-center gap-4 min-h-14 justify-between pt-2 border-t border-surface-light">
					<div>
						<p class="text-text-primary text-base font-normal leading-normal">Level</p>
						<p class="text-text-muted text-xs mt-0.5">Lower runs first</p>
					</div>
					<NumberInput v-model="level" :min="1" size="md" input-width="w-12" />
				</div>

				<!-- Enabled Toggle -->
				<div class="flex items-center gap-4 min-h-14 justify-between pt-2">
					<p class="text-text-primary text-base font-normal leading-normal">Enabled</p>
					<button
						:class="`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
							enabled ? 'bg-primary' : 'bg-surface-light'
						}`"
						@click="enabled = !enabled"
					>
						<span
							:class="`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
								enabled ? 'translate-x-6' : 'translate-x-1'
							}`"
						/>
					</button>
				</div>
			</div>

			<!-- Complete Rule Section Card -->
			<div>
				<h3 class="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
					Task Type
				</h3>
				<div class="rounded-xl bg-surface p-4 space-y-4">
					<RadioGroup
						:list="taskTypeOptions"
						:model-value="taskTypeIndex"
						@update:model-value="handleTaskTypeChange"
					/>

					<!-- Simple 类型积分设置 -->
					<div v-if="taskType === 'simple'" class="pt-4 border-t border-surface-light">
						<div class="flex items-center justify-between">
							<div class="text-text-secondary text-sm">Completion Points</div>
							<NumberInput v-model="completionPoints" :min="0" size="md" />
						</div>
					</div>

					<!-- Time/Count 阶段配置 -->
					<div
						v-if="taskType === 'time' || taskType === 'count'"
						class="pt-4 border-t border-surface-light space-y-4"
					>
						<div class="flex items-center justify-between">
							<p class="text-text-secondary text-sm">
								Stage Config (earn points on reaching goals)
							</p>
							<button
								class="flex items-center gap-1 text-sm text-primary hover:text-primary-light"
								@click="addStage"
							>
								<Plus class="w-4 h-4" />
								Add Stage
							</button>
						</div>

						<div
							v-for="(stage, index) in stages"
							:key="stage.id"
							class="bg-surface-light p-3 rounded-xl space-y-3"
						>
							<div class="flex items-center justify-between">
								<span class="text-text-muted text-sm">#{{ index + 1 }}</span>
								<button
									:disabled="stages.length <= 1"
									class="p-2 text-text-muted hover:text-error"
									@click="removeStage(index)"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							</div>

							<div class="flex items-center justify-between gap-3 min-w-0">
								<label class="flex-1 min-w-0 truncate text-xs text-text-muted">
									Reach{{ taskType === "time" ? "(min)" : "(times)" }}
								</label>
								<NumberInput
									:model-value="stage.threshold"
									:min="1"
									size="sm"
									input-width="w-16"
									class="shrink-0"
									@update:model-value="(v) => updateStage(index, 'threshold', v)"
								/>
							</div>

							<div class="flex items-center justify-between gap-3 min-w-0">
								<label class="flex-1 min-w-0 truncate text-xs text-text-muted">
									Earn Points
								</label>
								<NumberInput
									:model-value="stage.points"
									:min="0"
									size="sm"
									input-width="w-16"
									class="shrink-0"
									@update:model-value="(v) => updateStage(index, 'points', v)"
								/>
							</div>
						</div>

						<!-- 完成额外积分 -->
						<div class="flex items-center justify-between pt-2 border-t border-surface-light">
							<div class="text-text-secondary text-sm">Completion Bonus</div>
							<NumberInput
								v-model="completionPoints"
								:min="0"
								size="md"
								input-width="w-12"
							/>
						</div>

						<!-- 积分预览 -->
						<div class="text-sm text-text-muted pt-2">
							{{ `Max points: ${maxPointsForStages}` }}
						</div>
					</div>

					<!-- Subtask 配置 -->
					<div v-if="taskType === 'subtask'" class="pt-4 border-t border-surface-light space-y-4">
						<!-- Checklist -->
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<div class="text-text-secondary text-sm">Subtask List</div>
							</div>
							<!-- 添加新子任务 -->
							<div class="flex items-center gap-3 bg-surface-light p-3 rounded-xl">
								<span class="text-text-muted text-sm">New</span>
								<input
									v-model="newSubtask"
									type="text"
									placeholder="Add a subtask"
									class="flex-1 min-w-0 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1"
									@keydown.enter="handleAddSubtask"
								/>
								<button
									:disabled="!newSubtask.trim()"
									class="text-primary disabled:text-text-muted font-medium text-sm px-2 py-1 rounded-lg hover:bg-primary/10 disabled:hover:bg-transparent transition-colors"
									@click="handleAddSubtask"
								>
									Add
								</button>
							</div>

							<!-- 子任务列表 -->
							<div
								v-for="(subtask, index) in subtasks"
								:key="index"
								class="flex items-center gap-3 bg-surface-light p-3 rounded-xl"
							>
								<span class="text-text-muted text-sm w-6">{{ index + 1 }}.</span>
								<input
									:value="subtask"
									type="text"
									class="flex-1 min-w-0 bg-transparent text-text-primary focus:outline-none border-b-2 border-transparent focus:border-primary text-base font-normal leading-normal py-1"
									@input="(e) => (subtasks[index] = (e.target as HTMLInputElement).value)"
								/>
								<NumberInput
									:model-value="pointsPerSubtask[index] || 0"
									:min="0"
									size="sm"
									input-width="w-10"
									@update:model-value="(v) => (pointsPerSubtask[index] = v)"
								/>
								<button
									class="text-text-muted hover:text-primary transition-colors p-1"
									@click="handleDeleteSubtask(index)"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							</div>

							<p v-if="subtasks.length === 0" class="text-text-muted text-sm text-center py-4">
								No subtasks yet. Add one above.
							</p>
						</div>

						<!-- 子任务模式选择 -->
						<div class="flex gap-4 pt-4 border-t border-surface-light">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									:checked="subtaskMode === 'all'"
									class="w-4 h-4 accent-primary"
									@change="subtaskMode = 'all'"
								/>
								<span class="text-text-primary text-sm">Complete all subtasks</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									type="radio"
									:checked="subtaskMode === 'partial'"
									class="w-4 h-4 accent-primary"
									@change="subtaskMode = 'partial'"
								/>
								<span class="text-text-primary text-sm">Complete specified count</span>
							</label>
						</div>

						<!-- Partial 模式：设置需要完成的数量 -->
						<div v-if="subtaskMode === 'partial'" class="flex items-center gap-2">
							<span class="text-text-secondary text-sm">Complete</span>
							<NumberInput
								:model-value="requiredCount"
								:min="1"
								:max="subtasks.length || 1"
								size="sm"
								input-width="w-14"
								@update:model-value="
									(v) => (requiredCount = Math.min(subtasks.length, Math.max(1, v)))
								"
							/>
							<span class="text-text-secondary text-sm">items to complete</span>
						</div>

						<!-- 完成额外积分 -->
						<div class="flex items-center justify-between pt-2 border-t border-surface-light">
							<div class="text-text-secondary text-sm">Completion Bonus</div>
							<NumberInput
								v-model="completionPoints"
								:min="0"
								size="md"
								input-width="w-12"
							/>
						</div>

						<!-- 积分预览 -->
						<div class="text-sm text-text-muted pt-2">
							{{ `Max points: ${maxPointsForSubtasks}` }}
						</div>
					</div>
				</div>
			</div>

			<!-- Schedule Card - Start At & Expire -->
			<div>
				<div class="flex items-center justify-between px-2 pb-2 pt-4">
					<h3 class="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
						Schedule
					</h3>
					<button
						:class="`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
							isScheduleEnabled ? 'bg-primary' : 'bg-surface-light'
						}`"
						@click="handleScheduleToggle"
					>
						<span
							:class="`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
								isScheduleEnabled ? 'translate-x-6' : 'translate-x-1'
							}`"
						/>
					</button>
				</div>
				<div class="rounded-xl bg-surface p-4 space-y-4">
					<div
						:class="`flex items-center gap-4 ${!isScheduleEnabled ? 'opacity-50 pointer-events-none' : ''}`"
					>
						<p class="text-text-secondary text-sm min-w-[80px]">Start from</p>
						<div class="flex-1">
							<DatePicker
								:model-value="startAtDate"
								placeholder="Today (default)"
								:min-date="minToday"
								@change="handleStartAtChange"
							/>
						</div>
					</div>

					<div
						:class="`flex items-center gap-4 pt-4 border-t border-surface-light ${!isScheduleEnabled ? 'opacity-50 pointer-events-none' : ''}`"
					>
						<p class="text-text-secondary text-sm min-w-[80px]">Expire after</p>
						<NumberInput
							v-model="completeExpireDays"
							:min="0"
							size="md"
							input-width="w-14"
						/>
						<p class="text-text-secondary text-sm">days (0 = never)</p>
					</div>
					<p v-if="!isScheduleEnabled" class="text-text-muted text-xs">
						Enable schedule to set start date and expiration
					</p>
				</div>
			</div>

			<!-- Repeat & Ends Card -->
			<div>
				<h3 class="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
					Repeat
				</h3>
				<div :class="`rounded-xl bg-surface p-4 space-y-4 ${!isScheduleEnabled ? 'opacity-50' : ''}`">
					<RadioGroup
						:list="repeatOptions"
						:model-value="repeatIndex"
						@update:model-value="
							(index) => {
								if (isScheduleEnabled) repeatIndex = index;
							}
						"
					/>
					<p v-if="!isScheduleEnabled" class="text-text-muted text-xs">
						Enable schedule to set repeat mode
					</p>

					<div
						v-if="repeatMode !== 'none'"
						class="flex items-center gap-4 pt-2 border-t border-surface-light"
					>
						<p class="text-text-secondary text-sm">Every</p>
						<NumberInput
							v-model="repeatInterval"
							:min="1"
							size="md"
							input-width="w-10"
						/>
						<p class="text-text-secondary text-sm">
							<template v-if="repeatMode === 'daily'">days</template>
							<template v-else-if="repeatMode === 'weekly'">weeks</template>
							<template v-else-if="repeatMode === 'monthly'">months</template>
						</p>
					</div>

					<div v-if="repeatMode === 'weekly'" class="pt-2 border-t border-surface-light">
						<p class="text-text-secondary text-sm mb-3">On days</p>
						<MultiSelectGrid
							:list="weekDays"
							:value="repeatDaysOfWeek"
							:max-col="7"
							@change="handleWeekDayChange"
						/>
					</div>

					<div v-if="repeatMode === 'monthly'" class="pt-2 border-t border-surface-light">
						<p class="text-text-secondary text-sm mb-3">On days</p>
						<MultiSelectGrid
							:list="monthDays"
							:value="repeatDaysOfMonth"
							:max-col="7"
							@change="handleMonthDayChange"
						/>
					</div>

					<div v-if="repeatMode !== 'none'" class="pt-4 border-t border-surface-light space-y-4">
						<p class="text-text-primary text-sm font-medium">Ends</p>
						<RadioGroup
							:list="endOptions"
							v-model="endIndex"
						/>

						<div v-if="endCondition === 'date'" class="pt-2 border-t border-surface-light">
							<DatePicker
								:model-value="endValueDate"
								placeholder="Select end date"
								:min-date="minToday"
								@change="handleEndValueChange"
							/>
						</div>

						<div
							v-if="endCondition === 'times'"
							class="flex items-center gap-4 pt-2 border-t border-surface-light"
						>
							<p class="text-text-secondary text-sm">After</p>
							<NumberInput
								:model-value="parseInt(endValue, 10) || 1"
								:min="1"
								size="md"
								input-width="w-12"
								@update:model-value="(v) => (endValue = String(v))"
							/>
							<p class="text-text-secondary text-sm">times</p>
						</div>
					</div>
				</div>
			</div>
		</main>

		<!-- Bottom CTA Button -->
		<div class="px-4 pb-8 pt-4">
			<button
				:disabled="!title.trim() || isSubmitting"
				class="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				@click="handleSubmit"
			>
				<Loader2 v-if="isSubmitting" class="w-6 h-6 animate-spin" />
				<template v-else>{{ isEditMode ? "Update Task" : "Create Task" }}</template>
			</button>
		</div>
	</div>
</template>

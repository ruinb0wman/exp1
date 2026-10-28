<script setup lang="ts">
import { computed } from "vue";
import { RListCard } from "@ruinb0w/ui";
import type { TaskHistoryItem } from "@/db/services";
import type { RepeatMode, TaskTemplate, TaskInstance, TaskStatus } from "@/db/types";
import { getTaskProgressPercent, getTotalPointsEarned } from "@/db/services";
import { useUserStore } from "@/store";
import {
	isExpiredByInstanceDate,
	getExpireTimeTextByInstanceDate,
	type ExpireTimeResult,
} from "@/libs/time";
import { repeatModeMap } from "@/pages/AllTasks/lib";
import {
	getStatusLabel,
	formatDateTime,
	type StatusLabelKey,
	type DateTimeResult,
} from "./lib";

const props = withDefaults(
	defineProps<{
		item?: TaskHistoryItem;
		template?: TaskTemplate;
		instance?: TaskInstance;
		isPreview?: boolean;
	}>(),
	{
		isPreview: false,
	},
);

const emit = defineEmits<{
	click: [data: { template: TaskTemplate; instance?: TaskInstance }];
}>();

const userStore = useUserStore();

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

// 卡片配色/图标全部走语义 tone，配色实现留在 @ruinb0w/ui 的 RListCard
const STATUS_TONE: Record<TaskStatus, Tone> = {
	pending: "primary",
	completed: "success",
	skipped: "muted",
};
const STATUS_ICON: Record<TaskStatus, string> = {
	pending: "Circle",
	completed: "CheckCircle2",
	skipped: "XCircle",
};
const LEVEL_TONE: Record<number, Tone> = { 1: "success", 2: "primary", 3: "info" };
const REPEAT_TONE: Record<RepeatMode, Tone> = {
	none: "muted",
	daily: "primary",
	weekly: "info",
	monthly: "warning",
};

const template = computed(() => (props.item?.template ?? props.template)!);
const instance = computed(() => props.item?.instance ?? props.instance);
const dayEndTime = computed(() => userStore.user?.dayEndTime ?? "00:00");

const status = computed<TaskStatus>(() => instance.value?.status ?? "pending");

const progressPercent = computed(() =>
	instance.value ? getTaskProgressPercent(instance.value) : 0,
);

const earnedPoints = computed(() => {
	if (!instance.value) return 0;
	const rule = template.value?.completeRule;
	if (rule?.type === "simple" && instance.value.status === "completed") {
		return rule.completionPoints || 0;
	}
	return getTotalPointsEarned(instance.value);
});

const expireDays = computed(() => template.value?.completeExpireDays);
const hasExpireWindow = computed(
	() => !props.isPreview && !!expireDays.value && expireDays.value > 0,
);
const expired = computed(() =>
	hasExpireWindow.value
		? isExpiredByInstanceDate(
				instance.value?.instanceDate ?? "",
				expireDays.value!,
				dayEndTime.value,
			)
		: false,
);
const expireTimeResult = computed<ExpireTimeResult | null>(() =>
	hasExpireWindow.value
		? getExpireTimeTextByInstanceDate(
				instance.value?.instanceDate ?? "",
				expireDays.value!,
				dayEndTime.value,
			)
		: null,
);

const hasCompleteRule = computed(
	() =>
		!props.isPreview &&
		!!template.value.completeRule &&
		template.value.completeRule.type !== "simple",
);

function getProgressText(): string | null {
	if (!hasCompleteRule.value) return null;

	const rule = template.value.completeRule;
	if (!rule) return null;

	if (rule.type === "subtask") {
		const completedCount = (instance.value?.completedSubtasks || []).filter(
			Boolean,
		).length;
		const config = rule.subtaskConfig;
		const targetCount =
			config?.mode === "all"
				? instance.value?.subtasks.length || 0
				: config?.requiredCount || 1;
		return `${completedCount}/${targetCount} items`;
	}

	const progress = instance.value?.completeProgress ?? 0;
	const maxThreshold =
		rule.stages.length > 0
			? Math.max(...rule.stages.map((s) => s.threshold))
			: 0;
	const unit = rule.type === "time" ? "min" : "times";
	return `${progress}/${maxThreshold} ${unit}`;
}

const progressTone = computed<'primary' | 'success' | 'warning'>(() => {
	if (progressPercent.value >= 100) return "success";
	if (progressPercent.value >= 60) return "primary";
	return "warning";
});

function renderExpireTime(result: ExpireTimeResult) {
	switch (result.type) {
		case "expired":
			return "Expired";
		case "expiresInDays":
			return `Due ${result.value}d`;
		case "expiresInHours":
			return `Due ${result.hours}h`;
		case "expiresInMinutes":
			return `Due ${result.value}m`;
	}
	return "";
}

function renderStatusLabel(key: StatusLabelKey) {
	switch (key) {
		case "completed":
			return "Completed";
		case "skipped":
			return "Skipped";
		case "pending":
			return "Pending";
	}
	return "";
}

function renderDateTime(result: DateTimeResult | null) {
	if (!result) return null;
	switch (result.type) {
		case "today":
			return `Today ${result.time}`;
		case "yesterday":
			return `Yesterday ${result.time}`;
		case "daysAgo":
			return `${result.value} days ago ${result.time}`;
		case "monthDay":
			return `${result.month}/${result.day} ${result.time}`;
	}
	return null;
}

const statusText = computed(() =>
	renderStatusLabel(getStatusLabel(status.value)),
);

const badges = computed(() => [
	{ text: `L${template.value.level}`, type: LEVEL_TONE[template.value.level] ?? "muted" },
	{ text: repeatModeMap[template.value.repeatMode], type: REPEAT_TONE[template.value.repeatMode] },
]);

const metaItems = computed(() => {
	if (props.isPreview) return [{ text: "Preview Mode", tone: "muted" as Tone }];

	const items: Array<{ text: string; icon?: string; tone?: Tone }> = [];

	if (expireTimeResult.value) {
		items.push({
			text: renderExpireTime(expireTimeResult.value),
			icon: "AlertCircle",
			tone: expired.value ? "danger" : "warning",
		});
	}

	const dateTimeText = instance.value?.completedAt
		? renderDateTime(formatDateTime(instance.value.completedAt))
		: null;
	if (dateTimeText) {
		items.push({ text: `Completed ${dateTimeText}`, icon: "Flag", tone: "success" });
	}

	if (earnedPoints.value > 0) {
		items.push({ text: `+${earnedPoints.value} exp`, tone: "success" });
	}

	return items;
});

function handleClick() {
	if (props.isPreview) return;
	emit("click", { template: template.value, instance: instance.value });
}
</script>

<template>
	<RListCard
		:title="template.title"
		:icon="props.isPreview ? 'Eye' : STATUS_ICON[status]"
		:tone="props.isPreview ? 'muted' : STATUS_TONE[status]"
		:badges="badges"
		:meta="metaItems"
		:progress="
			hasCompleteRule
				? { percent: progressPercent, label: getProgressText() ?? '', color: progressTone }
				: null
		"
		:status="props.isPreview ? { text: 'Preview', tone: 'muted' } : { text: statusText, tone: STATUS_TONE[status] }"
		:disabled="props.isPreview"
		@click="handleClick"
	/>
</template>

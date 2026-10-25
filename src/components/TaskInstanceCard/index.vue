<script setup lang="ts">
import { computed } from "vue";
import { AlertCircle, Eye, Flag } from "@lucide/vue";
import type { TaskHistoryItem } from "@/db/services";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import { getTaskProgressPercent, getTotalPointsEarned } from "@/db/services";
import { useUserStore } from "@/store";
import {
	isExpiredByInstanceDate,
	getExpireTimeTextByInstanceDate,
	type ExpireTimeResult,
} from "@/libs/time";
import {
	repeatModeMap,
	repeatModeColorMap,
	levelBadgeClass,
} from "@/pages/AllTasks/lib";
import {
	getStatusIcon,
	getStatusStyle,
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

function getProgressColor(percent: number): string {
	if (percent >= 100) return "bg-green-500";
	if (percent >= 60) return "bg-primary";
	return "bg-yellow-500";
}

const template = computed(() => (props.item?.template ?? props.template)!);
const instance = computed(() => props.item?.instance ?? props.instance);
const dayEndTime = computed(() => userStore.user?.dayEndTime ?? "00:00");

const itemStatusIcon = computed(() =>
	props.isPreview ? Eye : getStatusIcon(instance.value?.status ?? "pending"),
);
const itemStatusStyle = computed(() =>
	props.isPreview
		? { color: "text-text-muted", bg: "bg-text-muted/20" }
		: getStatusStyle(instance.value?.status ?? "pending"),
);

const hasCompleteRule = computed(
	() =>
		!props.isPreview &&
		!!template.value.completeRule &&
		template.value.completeRule.type !== "simple",
);
const progressPercent = computed(() =>
	instance.value ? getTaskProgressPercent(instance.value) : 0,
);
const progressColor = computed(() =>
	getProgressColor(progressPercent.value),
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
const expired = computed(() =>
	!props.isPreview && expireDays.value && expireDays.value > 0
		? isExpiredByInstanceDate(
				instance.value?.instanceDate ?? "",
				expireDays.value,
				dayEndTime.value,
			)
		: false,
);
const expireTimeResult = computed<ExpireTimeResult | null>(() =>
	!props.isPreview && expireDays.value && expireDays.value > 0
		? getExpireTimeTextByInstanceDate(
				instance.value?.instanceDate ?? "",
				expireDays.value,
				dayEndTime.value,
			)
		: null,
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

const statusLabel = computed(() =>
	renderStatusLabel(getStatusLabel(instance.value?.status ?? "pending")),
);
const dateTimeText = computed(() =>
	instance.value?.completedAt
		? renderDateTime(formatDateTime(instance.value.completedAt))
		: null,
);

function handleClick() {
	if (props.isPreview) return;
	emit("click", { template: template.value, instance: instance.value });
}
</script>

<template>
	<button
		:disabled="isPreview"
		:class="`w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border text-left transition-colors ${
			isPreview
				? 'opacity-70 cursor-not-allowed'
				: 'hover:bg-surface-light cursor-pointer'
		}`"
		@click="handleClick"
	>
		<div
			:class="`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${itemStatusStyle.bg} ${itemStatusStyle.color}`"
		>
			<component :is="itemStatusIcon" class="w-5 h-5" />
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<p class="text-text-primary font-medium truncate">{{ template.title }}</p>
				<span :class="`text-xs px-2 py-0.5 rounded-full ${levelBadgeClass(template.level)}`">
					L{{ template.level }}
				</span>
				<span :class="`text-xs px-2 py-0.5 rounded-full ${repeatModeColorMap[template.repeatMode]}`">
					{{ repeatModeMap[template.repeatMode] }}
				</span>
			</div>
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary text-xs mt-1">
				<span v-if="isPreview" class="text-xs text-text-muted">Preview Mode</span>
				<template v-else>
					<span v-if="expireTimeResult" class="flex items-center gap-1">
						<AlertCircle :class="`w-3 h-3 ${expired ? 'text-red-500' : 'text-orange-500'}`" />
						{{ renderExpireTime(expireTimeResult) }}
					</span>
					<span v-if="instance?.completedAt && dateTimeText" class="flex items-center gap-1">
						<Flag class="w-3 h-3 text-green-500" />
						Completed {{ dateTimeText }}
					</span>
					<span v-if="earnedPoints > 0" class="text-green-500">+{{ earnedPoints }} exp</span>
				</template>
			</div>

			<div v-if="hasCompleteRule" class="flex items-center gap-2 mt-2">
				<div class="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
					<div
						:class="`h-full ${progressColor} transition-all duration-300`"
						:style="{ width: `${progressPercent}%` }"
					/>
				</div>
				<span class="text-xs text-text-secondary min-w-[60px] text-right">
					{{ getProgressText() }}
				</span>
			</div>
		</div>

		<span :class="`text-sm font-medium ${itemStatusStyle.color}`">
			{{ isPreview ? "Preview" : statusLabel }}
		</span>
	</button>
</template>

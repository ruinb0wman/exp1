<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import {
	BookOpen,
	Gift,
	RotateCcw,
	Settings,
	Trophy,
} from "lucide-vue-next";
import type { PointsHistory, PointsHistoryType } from "@/db/types";
import { formatRelativeDate } from "@/libs/time";
import {
	getAchievementById,
	getTaskInstanceById,
	getRewardPurchaseById,
} from "@/db/services";

const ICON_MAP = {
	task_reward: BookOpen,
	task_undo: RotateCcw,
	reward_exchange: Gift,
	achievement: Trophy,
	admin_adjustment: Settings,
} as const;

const POINTS_HISTORY_LABEL: Record<PointsHistoryType, string> = {
	task_reward: "Task Reward",
	task_undo: "Undo Deduction",
	task_stage: "Stage Reward",
	task_completion: "Completion Reward",
	task_deduction: "Progress Reverted",
	reward_exchange: "Purchase",
	achievement: "Achievement Reward",
	admin_adjustment: "Admin Adjustment",
};

function getPointsHistoryIcon(type: PointsHistoryType) {
	return ICON_MAP[type as keyof typeof ICON_MAP] ?? BookOpen;
}

function getPointsHistoryLabel(type: PointsHistoryType): string {
	return POINTS_HISTORY_LABEL[type] ?? POINTS_HISTORY_LABEL.task_reward;
}

async function getRelatedEntityName(
	item: PointsHistory,
): Promise<string | null> {
	if (!item.relatedInstanceId) return null;

	try {
		switch (item.type) {
			case "task_reward":
			case "task_undo":
			case "task_completion":
			case "task_stage":
			case "task_deduction": {
				const instance = await getTaskInstanceById(item.relatedInstanceId);
				return instance?.template?.title ?? null;
			}
			case "reward_exchange": {
				const purchase = await getRewardPurchaseById(item.relatedInstanceId);
				return purchase?.template?.title ?? null;
			}
			case "achievement": {
				const achievement = await getAchievementById(item.relatedInstanceId);
				return achievement?.title ?? null;
			}
			case "admin_adjustment":
			default:
				return null;
		}
	} catch {
		return null;
	}
}

const props = defineProps<{ item: PointsHistory }>();

const entityName = ref<string | null>(null);
const iconComponent = computed(() => getPointsHistoryIcon(props.item.type));
const isPositive = computed(() => props.item.amount > 0);
const label = computed(() => getPointsHistoryLabel(props.item.type));
const relativeDate = computed(() => formatRelativeDate(props.item.createdAt));

const relativeDateText = computed(() => {
	const r = relativeDate.value;
	switch (r.type) {
		case "today":
			return `Today ${r.time}`;
		case "yesterday":
			return `Yesterday ${r.time}`;
		case "daysAgo":
			return `${r.value} days ago ${r.time}`;
		case "monthDay":
			return `${r.month}/${r.day}`;
	}
	return "";
});

let mounted = true;

watch(
	() => props.item,
	(item) => {
		void getRelatedEntityName(item).then((name) => {
			if (mounted) entityName.value = name;
		});
	},
	{ immediate: true },
);

onUnmounted(() => {
	mounted = false;
});
</script>

<template>
	<div class="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
		<div
			:class="`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
				isPositive ? 'bg-green-500/20 text-green-500' : 'bg-primary/20 text-primary'
			}`"
		>
			<component :is="iconComponent" class="w-5 h-5" />
		</div>
		<div class="flex-1 min-w-0">
			<p class="text-text-primary font-medium">{{ entityName || label }}</p>
			<p class="text-text-secondary text-sm truncate">{{ item.description || label }}</p>
			<p class="text-text-muted text-xs">{{ relativeDateText }}</p>
		</div>
		<p
			:class="`font-bold text-lg ${isPositive ? 'text-green-500' : 'text-primary'}`"
		>
			{{ isPositive ? "+" : "" }}{{ item.amount }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { CheckCircle2, Sparkles, Trash2 } from "lucide-vue-next";
import type { Achievement } from "@/db/types";
import DynamicIcon from "@/components/DynamicIcon.vue";
import { formatCondition } from "@/libs/achievement/formatCondition";
import { formatUnlockTime } from "../lib";

const props = defineProps<{
	achievement: Achievement;
	templateTitle?: string;
}>();

// 不声明 emits：@abandon 留在 attrs，据此决定是否渲染「Abandon」按钮
const attrs = useAttrs();
const abandonHandler = computed(
	() => attrs.onAbandon as (() => void) | undefined,
);

const isUnlocked = computed(() => props.achievement.status === "unlocked");
const target = computed(() => props.achievement.condition.target);
const progress = computed(() =>
	Math.min(props.achievement.progress, target.value),
);
const percent = computed(() =>
	target.value > 0 ? Math.round((progress.value / target.value) * 100) : 0,
);
const conditionText = computed(() =>
	formatCondition(
		props.achievement.condition,
		props.templateTitle ?? props.achievement.templateTitleSnapshot,
	),
);
const containerClass = computed(() =>
	isUnlocked.value
		? "bg-primary/10 border-primary/40"
		: props.achievement.orphaned
			? "bg-surface border-border opacity-70"
			: "bg-surface border-border",
);
const unlockedAtText = computed(() =>
	props.achievement.unlockedAt
		? `Unlocked at ${formatUnlockTime(props.achievement.unlockedAt)}`
		: "",
);
</script>

<template>
	<div :class="`rounded-xl border p-4 mb-3 ${containerClass}`">
		<div class="flex items-start gap-3">
			<div
				:class="`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center ${
					isUnlocked ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
				}`"
			>
				<DynamicIcon :name="achievement.icon" class="w-6 h-6" />
			</div>

			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<h3 class="text-text-primary font-bold truncate">{{ achievement.title }}</h3>
					<CheckCircle2 v-if="isUnlocked" class="w-4 h-4 text-primary shrink-0" />
				</div>
				<p v-if="achievement.description" class="text-text-secondary text-sm mt-0.5">
					{{ achievement.description }}
				</p>
				<p class="text-text-muted text-xs mt-1">{{ conditionText }}</p>

				<p v-if="achievement.orphaned" class="text-yellow-500 text-xs mt-1">
					The bound task was deleted, this achievement is frozen
				</p>
			</div>

			<div class="text-right shrink-0">
				<p class="text-primary font-bold text-sm">+{{ achievement.rewardPoints }}</p>
				<p class="text-text-muted text-xs">exp</p>
			</div>
		</div>

		<div v-if="!isUnlocked" class="mt-3">
			<div class="flex items-center justify-between mb-1">
				<span class="text-text-secondary text-xs">Progress</span>
				<span class="text-text-primary text-xs font-medium">
					{{ progress }} / {{ target }}
				</span>
			</div>
			<div class="w-full rounded-full bg-surface-light h-2">
				<div
					class="h-2 rounded-full bg-primary transition-all duration-300"
					:style="{ width: `${percent}%` }"
				/>
			</div>
		</div>

		<div v-if="isUnlocked && achievement.unlockedAt" class="mt-3 flex items-center gap-1.5 text-text-muted text-xs">
			<Sparkles class="w-3.5 h-3.5" />
			{{ unlockedAtText }}
		</div>

		<div v-if="abandonHandler && !isUnlocked" class="mt-3 flex justify-end">
			<button
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-primary hover:bg-surface-light transition-colors"
				@click="abandonHandler && abandonHandler()"
			>
				<Trash2 class="w-4 h-4" />
				Abandon
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Check, X } from "@lucide/vue";
import type { Achievement } from "@/db/types";
import DynamicIcon from "@/components/DynamicIcon.vue";
import { formatCondition } from "@/libs/achievement/formatCondition";

const props = defineProps<{
	achievement: Achievement;
	templateTitle?: string;
}>();

const emit = defineEmits<{ accept: []; dismiss: [] }>();

const conditionText = computed(() =>
	formatCondition(
		props.achievement.condition,
		props.templateTitle ?? props.achievement.templateTitleSnapshot,
	),
);
</script>

<template>
	<div class="rounded-xl border border-border bg-surface p-4 mb-3">
		<div class="flex items-start gap-3">
			<div class="w-11 h-11 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
				<DynamicIcon :name="achievement.icon" class="w-6 h-6" />
			</div>

			<div class="flex-1 min-w-0">
				<h3 class="text-text-primary font-bold">{{ achievement.title }}</h3>
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

		<div class="mt-3 flex gap-2 justify-end">
			<button
				class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
				@click="emit('dismiss')"
			>
				<X class="w-4 h-4" />
				Dismiss
			</button>
			<button
				class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
				@click="emit('accept')"
			>
				<Check class="w-4 h-4" />
				Accept
			</button>
		</div>
	</div>
</template>

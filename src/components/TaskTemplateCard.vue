<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Power } from "@lucide/vue";
import type { RepeatMode, CompleteRule } from "@/db/types";
import { calculateMaxPoints } from "@/db/types/task";
import {
	levelBadgeClass,
	repeatModeMap,
	repeatModeColorMap,
} from "@/pages/AllTasks/lib";

const props = defineProps<{
	id: string;
	title: string;
	description?: string;
	level: number;
	repeatMode: RepeatMode;
	enabled: boolean;
	completeRule?: CompleteRule;
	subtasks: string[];
	isActionLoading: boolean;
}>();

const emit = defineEmits<{
	click: [];
	toggleEnabled: [e: MouseEvent];
}>();

const maxPoints = computed(() =>
	props.completeRule ? calculateMaxPoints(props.completeRule) : 0,
);
</script>

<template>
	<div
		:class="`flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border transition-colors ${
			enabled ? 'border-border hover:border-surface-light' : 'border-border/50 opacity-60'
		}`"
	>
		<div class="flex items-center gap-4 flex-1 cursor-pointer" @click="emit('click')">
			<div class="flex flex-col justify-center flex-1">
				<div class="flex items-center gap-2">
					<p
						:class="`text-base font-medium leading-normal line-clamp-1 transition-all ${
							enabled ? 'text-text-primary' : 'text-text-secondary'
						}`"
					>
						{{ title }}
					</p>
					<span :class="`text-xs px-2 py-0.5 rounded-full ${levelBadgeClass(level)}`">
						L{{ level }}
					</span>
					<span :class="`text-xs px-2 py-0.5 rounded-full ${repeatModeColorMap[repeatMode]}`">
						{{ repeatModeMap[repeatMode] }}
					</span>
				</div>
				<p
					:class="`text-sm font-normal leading-normal line-clamp-1 transition-all ${
						enabled ? 'text-text-secondary' : 'text-text-muted'
					}`"
				>
					{{ description || (maxPoints > 0 ? `+${maxPoints} exp` : "Simple task") }}
				</p>
				<p v-if="subtasks.length > 0" class="text-xs text-text-muted mt-1">
					{{ subtasks.length }} checklist item{{ subtasks.length > 1 ? "s" : "" }}
				</p>
			</div>
		</div>

		<!-- Actions -->
		<div class="shrink-0 flex items-center gap-2">
			<!-- Enable/Disable Toggle -->
			<button
				:disabled="isActionLoading"
				:class="`p-2 rounded-lg transition-colors ${
					enabled
						? 'text-primary hover:bg-primary/10'
						: 'text-text-muted hover:bg-surface-light'
				}`"
				:title="enabled ? 'Disable' : 'Enable'"
				@click="emit('toggleEnabled', $event)"
			>
				<Power class="w-4 h-4" />
			</button>

			<ChevronRight class="w-5 h-5 text-text-muted" />
		</div>
	</div>
</template>

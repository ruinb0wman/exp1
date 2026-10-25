<script setup lang="ts">
import { ChevronRight, Power } from "@lucide/vue";
import DynamicIcon from "@/components/DynamicIcon.vue";
import type { RewardTemplate } from "@/db/types";
import { formatRewardSubtitle } from "../lib";

const props = defineProps<{
	template: RewardTemplate;
	isActionLoading: boolean;
}>();

const emit = defineEmits<{
	click: [];
	toggleEnabled: [];
}>();
</script>

<template>
	<div
		class="flex items-center gap-3 rounded-xl bg-surface border border-border p-3 cursor-pointer hover:bg-surface-light transition-colors"
		@click="emit('click')"
	>
		<div
			class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
			:class="{ 'opacity-40': !props.template.enabled }"
			:style="{ backgroundColor: `${props.template.iconColor ?? '#f56565'}20` }"
		>
			<DynamicIcon
				:name="props.template.icon"
				:color="props.template.iconColor ?? '#f56565'"
				class="w-5 h-5"
			/>
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<p
					class="font-medium truncate"
					:class="props.template.enabled ? 'text-text-primary' : 'text-text-secondary'"
				>
					{{ props.template.title }}
				</p>
				<span
					v-if="!props.template.enabled"
					class="shrink-0 rounded-full bg-text-muted/20 text-text-muted text-[10px] font-bold px-2 py-0.5"
				>
					Disabled
				</span>
			</div>
			<p class="text-text-muted text-xs mt-0.5 truncate">
				{{ formatRewardSubtitle(props.template) }}
			</p>
		</div>

		<!-- 启用/停用开关 -->
		<button
			:disabled="props.isActionLoading"
			:class="`p-2 rounded-lg transition-colors disabled:opacity-40 ${
				props.template.enabled
					? 'text-primary hover:bg-primary/10'
					: 'text-text-muted hover:bg-surface-light'
			}`"
			:title="props.template.enabled ? 'Disable' : 'Enable'"
			@click.stop="emit('toggleEnabled')"
		>
			<Power class="w-4 h-4" />
		</button>

		<ChevronRight class="w-5 h-5 shrink-0 text-text-muted" />
	</div>
</template>

<script setup lang="ts">
import type { QuickAction } from "../lib";

defineProps<{
	actions: QuickAction[];
}>();

const emit = defineEmits<{ actionClick: [path: string] }>();
</script>

<template>
	<div class="grid grid-cols-3 gap-3 px-4 py-2">
		<button
			v-for="action in actions"
			:key="action.label"
			class="relative flex flex-col items-center gap-3 rounded-xl bg-surface p-4 text-center border border-border hover:bg-surface-light transition-colors"
			@click="emit('actionClick', action.path)"
		>
			<component :is="action.icon" class="w-6 h-6 text-primary" />
			<h2 class="text-text-primary text-sm font-bold">{{ action.label }}</h2>
			<span
				v-if="action.badge !== undefined && action.badge > 0"
				class="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center"
			>
				{{ action.badge }}
			</span>
		</button>
	</div>
</template>

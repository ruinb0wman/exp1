<script setup lang="ts">
import { POMO_MODE_LABEL, type PomoMode } from "@/db/types/pomo";

defineProps<{
	currentMode: PomoMode;
	isRunning: boolean;
}>();

const emit = defineEmits<{ modeChange: [mode: PomoMode] }>();

const MODES: PomoMode[] = ["focus", "shortBreak", "longBreak"];
</script>

<template>
	<div class="px-4 mt-4">
		<div class="bg-surface rounded-2xl p-1.5 flex gap-1">
			<button
				v-for="targetMode in MODES"
				:key="targetMode"
				:disabled="isRunning"
				:class="`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
					currentMode === targetMode
						? 'bg-surface-light text-white'
						: 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
				} ${isRunning && currentMode !== targetMode ? 'opacity-50 cursor-not-allowed' : ''}`"
				@click="emit('modeChange', targetMode)"
			>
				{{ POMO_MODE_LABEL[targetMode] }}
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Settings, Timer, Volume2, VolumeX } from "lucide-vue-next";

defineProps<{
	/** 今日完成的番茄数 */
	todayCount: number;
	/** 是否启用音效 */
	soundEnabled: boolean;
}>();

const emit = defineEmits<{ toggleSound: []; openSettings: [] }>();
</script>

<template>
	<header class="px-4 pb-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
				<Timer class="w-5 h-5 text-primary" />
			</div>
			<div>
				<h1 class="text-xl font-bold text-white">Pomodoro</h1>
				<p class="text-xs text-text-secondary">{{ `${todayCount} completed today` }}</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
				@click="emit('toggleSound')"
			>
				<Volume2 v-if="soundEnabled" class="w-5 h-5" />
				<VolumeX v-else class="w-5 h-5" />
			</button>
			<button
				class="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
				@click="emit('openSettings')"
			>
				<Settings class="w-5 h-5" />
			</button>
		</div>
	</header>
</template>

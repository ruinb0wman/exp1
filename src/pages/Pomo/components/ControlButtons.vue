<script setup lang="ts">
import { Pause, Play, RotateCcw, Square } from "lucide-vue-next";

const props = defineProps<{
	isRunning: boolean;
	isPaused: boolean;
}>();

const emit = defineEmits<{
	start: [];
	pause: [];
	resume: [];
	reset: [];
	stop: [];
	complete: [];
}>();

function handleMainClick() {
	if (!props.isRunning) {
		emit("start");
	} else if (props.isPaused) {
		emit("resume");
	} else {
		emit("pause");
	}
}
</script>

<template>
	<div>
		<div class="flex items-center justify-center gap-6">
			<!-- 重置 -->
			<button
				:disabled="isRunning"
				class="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				@click="emit('reset')"
			>
				<RotateCcw class="w-6 h-6" />
			</button>

			<!-- 主控制 -->
			<button
				class="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
				@click="handleMainClick"
			>
				<Play
					v-if="!isRunning || isPaused"
					class="w-8 h-8 text-white ml-1"
					fill="white"
				/>
				<Pause v-else class="w-8 h-8 text-white" fill="white" />
			</button>

			<!-- 停止 -->
			<button
				:disabled="!isRunning"
				class="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-primary hover:bg-surface-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				@click="emit('stop')"
			>
				<Square class="w-6 h-6" fill="currentColor" />
			</button>
		</div>

		<!-- 提前完成 -->
		<button
			v-if="isRunning"
			class="w-full mt-4 py-3 text-sm text-text-secondary hover:text-primary transition-colors"
			@click="emit('complete')"
		>
			Complete Early
		</button>
	</div>
</template>

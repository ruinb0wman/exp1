<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { usePomoStore } from "@/store/pomoStore";
import {
	POMO_MODE_CONFIG,
	POMO_MODE_LABEL,
	POMO_MODE_RUNNING_LABEL,
	type PomoMode,
} from "@/db/types/pomo";

/**
 * 番茄钟计时器显示组件
 *
 * 注意：计时逻辑已移至 useGlobalPomoTimer composable，此组件只负责显示
 */
const pomoStore = usePomoStore();
const { timeLeft, totalTime, mode, isRunning, isPaused } = storeToRefs(pomoStore);

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const size = 280;
const strokeWidth = 8;

const progress = computed(() => (totalTime.value - timeLeft.value) / totalTime.value * 100);
const config = computed(() => POMO_MODE_CONFIG[mode.value as PomoMode]);

// 圆形进度条参数
const radius = (size - strokeWidth) / 2;
const circumference = radius * 2 * Math.PI;
const strokeDashoffset = computed(
	() => circumference - (progress.value / 100) * circumference,
);

const statusLabel = computed(() =>
	isRunning.value
		? isPaused.value
			? "Paused"
			: POMO_MODE_RUNNING_LABEL[mode.value as PomoMode]
		: POMO_MODE_LABEL[mode.value as PomoMode],
);

const ticks = Array.from({ length: 12 }, (_, i) => i);
</script>

<template>
	<div class="relative flex items-center justify-center">
		<!-- SVG 进度环 -->
		<svg :width="size" :height="size" class="transform -rotate-90">
			<!-- 背景圆环 -->
			<circle
				:cx="size / 2"
				:cy="size / 2"
				:r="radius"
				fill="none"
				stroke="#2a2a30"
				:stroke-width="strokeWidth"
			/>

			<!-- 进度圆环 -->
			<circle
				:cx="size / 2"
				:cy="size / 2"
				:r="radius"
				fill="none"
				:stroke="config.color"
				:stroke-width="strokeWidth"
				stroke-linecap="round"
				:stroke-dasharray="circumference"
				:stroke-dashoffset="strokeDashoffset"
				class="transition-all duration-1000 ease-linear"
			/>
		</svg>

		<!-- 中心内容 -->
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<!-- 时间显示 -->
			<div class="text-6xl font-bold font-display tracking-tight text-white">
				{{ formatTime(timeLeft) }}
			</div>

			<!-- 状态标签 -->
			<div
				class="mt-2 text-lg font-medium px-4 py-1 rounded-full"
				:style="{ backgroundColor: `${config.color}20`, color: config.color }"
			>
				{{ statusLabel }}
			</div>
		</div>

		<!-- 刻度点（装饰） -->
		<div
			v-for="i in ticks"
			:key="i"
			class="absolute w-1 h-1 bg-text-muted rounded-full"
			:style="{ transform: `rotate(${i * 30}deg) translateY(${-size / 2 + 16}px)` }"
		/>
	</div>
</template>

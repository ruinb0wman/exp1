<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { parseTimeString, formatTimeString } from "@/libs/time";
import { Check, X } from "lucide-vue-next";
import { useBackButtonHandler } from "@/composables/useBackButtonHandler";
import WheelPicker from "./WheelPicker.vue";

const props = withDefaults(
	defineProps<{
		isOpen: boolean;
		modelValue: string;
		title?: string;
		minuteInterval?: number;
	}>(),
	{
		minuteInterval: 15,
	},
);

const emit = defineEmits<{
	"update:modelValue": [value: string];
	close: [];
}>();

const parseInitial = () => {
	const { hour, minute } = parseTimeString(props.modelValue);
	return {
		hour,
		minute: Math.floor(minute / props.minuteInterval) * props.minuteInterval,
	};
};

const initial = parseInitial();
const hour = ref(initial.hour);
const minute = ref(initial.minute);

watch(
	() => [props.modelValue, props.minuteInterval] as const,
	() => {
		const { hour: h, minute: m } = parseTimeString(props.modelValue);
		hour.value = h;
		minute.value = Math.floor(m / props.minuteInterval) * props.minuteInterval;
	},
);

function handleConfirm() {
	emit("update:modelValue", formatTimeString(hour.value, minute.value));
	emit("close");
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from(
	{ length: 60 / props.minuteInterval },
	(_, i) => i * props.minuteInterval,
);

const displayTitle = computed(() => props.title ?? "Select Time");
const selectedText = computed(() => formatTimeString(hour.value, minute.value));

// Android 返回手势关浮层
useBackButtonHandler(
	() => props.isOpen,
	() => emit("close"),
);
</script>

<template>
	<div v-if="isOpen" class="fixed inset-0 z-50 flex items-end justify-center">
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

		<div class="relative w-full max-w-sm mx-4 mb-4 bg-surface rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
			<div class="flex items-center justify-between px-4 py-3 border-b border-border">
				<button
					class="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
					@click="emit('close')"
				>
					<X class="w-5 h-5" />
				</button>
				<h3 class="text-text-primary font-semibold">{{ displayTitle }}</h3>
				<button
					class="p-2 -mr-2 text-primary hover:text-primary-light transition-colors"
					@click="handleConfirm"
				>
					<Check class="w-5 h-5" />
				</button>
			</div>

			<div class="flex items-center justify-center py-6 px-8">
				<div class="flex-1 flex flex-col items-center">
					<span class="text-text-secondary text-xs mb-2">h</span>
					<WheelPicker
						v-model="hour"
						:options="hours"
						:format="(v) => String(v).padStart(2, '0')"
					/>
				</div>

				<div class="px-4 pt-6">
					<span class="text-text-primary text-2xl font-bold">:</span>
				</div>

				<div class="flex-1 flex flex-col items-center">
					<span class="text-text-secondary text-xs mb-2">m</span>
					<WheelPicker
						v-model="minute"
						:options="minutes"
						:format="(v) => String(v).padStart(2, '0')"
					/>
				</div>
			</div>

			<div class="px-4 pb-4 text-center">
				<p class="text-text-secondary text-sm">{{ `Selected: ${selectedText}` }}</p>
			</div>
		</div>
	</div>
</template>

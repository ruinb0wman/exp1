<script setup lang="ts">
import Slider from "@/components/Slider.vue";

withDefaults(
	defineProps<{
		/** 标签文本 */
		label: string;
		/** 当前值（分钟） */
		modelValue: number;
		/** 最小值 */
		min: number;
		/** 最大值 */
		max: number;
		/** 单位文本，默认为空 */
		unit?: string;
		/** 是否禁用 */
		disabled?: boolean;
	}>(),
	{
		unit: "",
		disabled: false,
	},
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();
</script>

<template>
	<div class="space-y-2">
		<div class="flex justify-between text-sm">
			<span class="text-text-secondary">{{ label }}</span>
			<span class="text-text-primary font-medium">{{ modelValue }} {{ unit }}</span>
		</div>
		<Slider
			:model-value="modelValue"
			:min="min"
			:max="max"
			:disabled="disabled"
			@update:model-value="(v) => emit('update:modelValue', v)"
		/>
	</div>
</template>

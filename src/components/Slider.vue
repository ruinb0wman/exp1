<script setup lang="ts">
withDefaults(
	defineProps<{
		/** 当前值 */
		modelValue: number;
		/** 最小值 */
		min: number;
		/** 最大值 */
		max: number;
		/** 步长，默认为1 */
		step?: number;
		/** 自定义类名 */
		class?: string;
		/** 是否禁用 */
		disabled?: boolean;
	}>(),
	{
		step: 1,
		class: "",
		disabled: false,
	},
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

function handleInput(event: Event) {
	emit("update:modelValue", parseFloat((event.target as HTMLInputElement).value));
}
</script>

<template>
	<input
		type="range"
		:min="min"
		:max="max"
		:step="step"
		:value="modelValue"
		:disabled="disabled"
		:class="`w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed ${$props.class}`"
		@input="handleInput"
	/>
</template>

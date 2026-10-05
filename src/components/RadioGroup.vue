<script setup lang="ts">
defineProps<{
	list: string[];
	/** 当前选中项的下标 */
	modelValue: number;
}>();

const emit = defineEmits<{ "update:modelValue": [index: number] }>();
</script>

<template>
	<div class="grid grid-cols-4 gap-2">
		<button
			v-for="(label, index) in list"
			:key="index"
			:class="`flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors ${
				modelValue === index
					? 'bg-primary text-white'
					: 'bg-surface text-text-primary border border-border hover:bg-surface-light'
			}`"
			@click="emit('update:modelValue', index)"
		>
			{{ label }}
		</button>
	</div>
</template>

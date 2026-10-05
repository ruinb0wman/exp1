<script setup lang="ts">
defineProps<{
	list: Array<{ label: string; value: number }>;
	value: number[];
	maxCol?: number;
	/** 选项宽度，默认 "auto" 表示自适应，可传入具体值如 "2.25rem"、"36px"、"100%" */
	itemWidth?: "auto" | string;
}>();

const emit = defineEmits<{ change: [value: number] }>();
</script>

<template>
	<div
		class="grid gap-2"
		:style="{
			gridTemplateColumns:
				(itemWidth ?? 'auto') === 'auto'
					? `repeat(${maxCol ?? 7}, minmax(0, 1fr))`
					: `repeat(${maxCol ?? 7}, ${itemWidth})`,
		}"
	>
		<button
			v-for="item in list"
			:key="item.value"
			:class="`h-9 rounded-full text-sm font-medium transition-colors ${
				value.includes(item.value)
					? 'bg-primary text-white'
					: 'bg-surface-light text-text-secondary hover:bg-surface-light/80'
			}`"
			@click="emit('change', item.value)"
		>
			{{ item.label }}
		</button>
	</div>
</template>

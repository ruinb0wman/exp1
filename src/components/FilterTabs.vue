<script setup lang="ts" generic="T extends string">
defineProps<{
	options: readonly T[];
	activeFilter: T;
}>();

const emit = defineEmits<{ change: [filter: T] }>();
</script>

<template>
	<div class="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
		<button
			v-for="option in options"
			:key="option"
			:class="`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
				activeFilter === option
					? 'bg-primary text-white'
					: 'bg-surface text-text-secondary hover:bg-surface-light'
			}`"
			@click="emit('change', option)"
		>
			<slot name="label" :option="option">{{ option }}</slot>
		</button>
	</div>
</template>

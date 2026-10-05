<script setup lang="ts">
defineProps<{
	label: string;
	/** 左槽传 start、右槽传 end，使图标贴向屏幕外缘 */
	side?: "start" | "end";
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
	<button
		type="button"
		:aria-label="label"
		:title="label"
		:class="`flex size-11 items-center ${
			side === 'end' ? 'justify-end' : 'justify-start'
		} text-text-secondary hover:text-primary transition-colors`"
		@click="emit('click')"
	>
		<slot />
	</button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";

withDefaults(
	defineProps<{
		title?: string;
		retryLabel?: string;
	}>(),
	{
		title: "Failed to load data",
		retryLabel: "Retry",
	},
);

// 不声明 emits：这样父组件的 @retry 会留在 attrs 里，可据此判断是否渲染按钮
const attrs = useAttrs();
const retryHandler = computed(
	() => attrs.onRetry as (() => void) | undefined,
);
</script>

<template>
	<div class="flex flex-col items-center justify-center py-16 text-text-muted">
		<p class="text-base font-medium">{{ title }}</p>
		<button
			v-if="retryHandler"
			class="mt-2 text-primary hover:text-primary-light"
			@click="retryHandler && retryHandler()"
		>
			{{ retryLabel }}
		</button>
	</div>
</template>

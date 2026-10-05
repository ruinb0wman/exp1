<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		message?: string;
		size?: "sm" | "md" | "lg";
	}>(),
	{
		message: "Loading...",
		size: "md",
	},
);

const sizeMap = {
	sm: { spinner: "w-6 h-6", text: "text-xs" },
	md: { spinner: "w-8 h-8", text: "text-sm" },
	lg: { spinner: "w-12 h-12", text: "text-base" },
};

const sizes = computed(() => sizeMap[props.size]);
</script>

<template>
	<div class="flex flex-col items-center justify-center py-16 text-text-muted">
		<div :class="`${sizes.spinner} border-2 border-primary border-t-transparent rounded-full animate-spin`" />
		<p :class="`${sizes.text} mt-4`">{{ message }}</p>
	</div>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { ChevronLeft } from "lucide-vue-next";
import { useRouter } from "vue-router";

withDefaults(
	defineProps<{
		title: string;
		back?: boolean;
	}>(),
	{
		back: false,
	},
);

// 不声明 emits：父组件的 @back 会留在 attrs 里，据此决定是否覆盖默认返回
const attrs = useAttrs();
const router = useRouter();

function handleBack() {
	const onBack = attrs.onBack as (() => void) | undefined;
	if (onBack) {
		onBack();
	} else {
		router.back();
	}
}
</script>

<template>
	<header class="flex h-header items-center bg-background px-4 justify-between sticky top-0 z-10 border-b border-border">
		<!-- Left Section -->
		<div class="flex size-11 shrink-0 items-center justify-start">
			<button
				v-if="back"
				type="button"
				aria-label="Back"
				class="flex size-11 items-center justify-start text-text-primary hover:text-primary transition-colors"
				@click="handleBack"
			>
				<ChevronLeft class="w-6 h-6" />
			</button>
			<slot v-else name="left" />
		</div>

		<!-- Center Title -->
		<h1 class="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center truncate">
			{{ title }}
		</h1>

		<!-- Right Section -->
		<div class="flex size-11 shrink-0 items-center justify-end">
			<slot name="right" />
		</div>
	</header>
</template>

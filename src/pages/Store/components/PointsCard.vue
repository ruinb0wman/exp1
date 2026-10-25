<script setup lang="ts">
import { Star } from "@lucide/vue";

defineProps<{
	currentPoints: number;
}>();
</script>

<template>
	<div class="flex items-center justify-between gap-4 rounded-xl bg-surface p-4 border border-border">
		<div class="flex flex-col gap-1">
			<p class="text-text-secondary text-sm font-bold">Your EXP</p>
			<p class="text-text-primary text-2xl font-bold">
				{{ currentPoints.toLocaleString() }} exp
			</p>
		</div>
		<div class="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center">
			<Star class="w-8 h-8 fill-current" />
		</div>
	</div>
</template>

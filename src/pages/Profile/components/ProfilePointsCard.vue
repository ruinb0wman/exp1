<script setup lang="ts">
defineProps<{
	currentPoints: number;
}>();
</script>

<template>
	<div class="p-4">
		<div class="rounded-xl bg-primary p-6">
			<p class="text-white/80 text-sm font-normal">CURRENT EXP</p>
			<p class="text-white text-4xl font-bold mt-1">{{ currentPoints }} exp</p>
			<p class="text-white/80 text-base mt-1">
				Well done! Keep up the great work.
			</p>
		</div>
	</div>
</template>

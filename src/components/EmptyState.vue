<script setup lang="ts">
import { Plus } from "lucide-vue-next";

defineProps<{
	title: string;
	description?: string;
}>();
</script>

<template>
	<div class="flex flex-col items-center justify-center py-16 text-text-muted">
		<div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
			<slot>
				<Plus class="w-8 h-8" />
			</slot>
		</div>
		<p class="text-base font-medium">{{ title }}</p>
		<p v-if="description" class="text-sm mt-1">{{ description }}</p>
	</div>
</template>

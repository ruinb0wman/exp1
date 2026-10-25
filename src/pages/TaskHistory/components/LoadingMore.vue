<script setup lang="ts">
import { Loader2 } from "@lucide/vue";

defineProps<{
	isLoadingMore: boolean;
	hasMore: boolean;
	listLength: number;
}>();
</script>

<template>
	<div v-if="isLoadingMore" class="flex items-center justify-center gap-2 text-text-secondary">
		<Loader2 class="w-4 h-4 animate-spin" />
		<span class="text-sm">Loading...</span>
	</div>

	<div v-else-if="hasMore" class="h-4" />

	<p v-else-if="listLength > 0" class="text-center text-text-muted text-sm">
		No more records
	</p>
</template>

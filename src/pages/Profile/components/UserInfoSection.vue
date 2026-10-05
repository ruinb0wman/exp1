<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
	user: { name?: string } | null;
}>();

const initial = computed(() => props.user?.name?.charAt(0).toUpperCase() ?? "U");
const handle = computed(
	() => `@${props.user?.name?.toLowerCase().replace(/\s+/g, "_") ?? "user"}`,
);
</script>

<template>
	<div class="p-4">
		<div class="flex gap-4 items-center">
			<div class="w-20 h-20 rounded-xl bg-surface flex items-center justify-center text-text-primary text-2xl font-bold border border-border">
				{{ initial }}
			</div>
			<div class="flex flex-col justify-center flex-1">
				<p class="text-text-primary text-[22px] font-bold">{{ user?.name ?? "User" }}</p>
				<p class="text-text-secondary text-base">{{ handle }}</p>
			</div>
		</div>
	</div>
</template>

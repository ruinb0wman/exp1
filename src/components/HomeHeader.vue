<script setup lang="ts">
import { Star } from "@lucide/vue";
import type { User } from "@/db/types";

defineProps<{
	user: User | null;
	currentPoints: number;
}>();
</script>

<template>
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-primary font-bold border border-border">
				{{ user?.name?.[0]?.toUpperCase() ?? "U" }}
			</div>
			<div class="flex flex-col">
				<p class="text-text-secondary text-sm font-normal">Good Morning!</p>
				<h1 class="text-text-primary text-xl font-bold tracking-tight">
					{{ user?.name ?? "User" }}
				</h1>
			</div>
		</div>
		<div class="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border">
			<Star class="w-4 h-4 text-primary fill-primary" />
			<p class="text-text-primary text-sm font-bold">{{ currentPoints }} exp</p>
		</div>
	</div>
</template>

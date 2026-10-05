<script setup lang="ts">
import { computed } from "vue";
import type { TrendBucket } from "@/libs/report/types";

const props = defineProps<{
	trend: TrendBucket[];
}>();

const maxPlanned = computed(() =>
	Math.max(...props.trend.map((bucket) => bucket.planned), 1),
);

function plannedHeight(bucket: TrendBucket) {
	return Math.round((bucket.planned / maxPlanned.value) * 100);
}

function completedHeight(bucket: TrendBucket) {
	const planned = plannedHeight(bucket);
	return bucket.planned > 0
		? Math.round((bucket.completed / bucket.planned) * planned)
		: 0;
}
</script>

<template>
	<p v-if="trend.length === 0" class="text-text-muted text-sm py-6 text-center">
		No data for this period
	</p>

	<div v-else class="overflow-x-auto scrollbar-hide">
		<div class="flex items-end gap-1 min-w-full h-32 pt-2">
			<div
				v-for="bucket in trend"
				:key="bucket.key"
				class="flex-1 min-w-6 h-full flex flex-col"
				:title="`${bucket.label}: ${bucket.completed}/${bucket.planned} · ${bucket.focusMinutes}min · ${bucket.pointsNet}pt`"
			>
				<div class="flex-1 flex items-end w-full">
					<div
						class="relative w-full rounded-t bg-surface-light"
						:style="{ height: `${Math.max(plannedHeight(bucket), 2)}%` }"
					>
						<div
							class="absolute bottom-0 left-0 right-0 rounded-t bg-primary"
							:style="{ height: `${completedHeight(bucket)}%` }"
						/>
					</div>
				</div>
				<span class="text-text-muted text-[9px] mt-1 whitespace-nowrap">
					{{ bucket.key.slice(5) }}
				</span>
			</div>
		</div>
	</div>
</template>

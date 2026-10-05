<script setup lang="ts">
import type { LevelBucket } from "@/libs/report/types";
import { levelBadgeClass } from "@/pages/AllTasks/lib";
import { formatRate, rateClass } from "../lib";

defineProps<{
	levels: LevelBucket[];
}>();
</script>

<template>
	<p v-if="levels.length === 0" class="text-text-muted text-sm py-6 text-center">
		No data for this period
	</p>

	<div v-else class="overflow-x-auto scrollbar-hide -mx-1 px-1">
		<table class="w-full text-sm border-collapse min-w-[560px]">
			<thead>
				<tr class="text-text-secondary text-xs">
					<th class="text-left font-medium py-2 pr-2">Level</th>
					<th class="text-right font-medium py-2 px-2">Planned</th>
					<th class="text-right font-medium py-2 px-2">Completed</th>
					<th class="text-right font-medium py-2 px-2">Completion rate</th>
					<th class="text-right font-medium py-2 px-2">Days with tasks</th>
					<th class="text-right font-medium py-2 px-2">Cleared days</th>
					<th class="text-right font-medium py-2 pl-2">Survival rate</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="bucket in levels" :key="bucket.level" class="border-t border-border">
					<td class="py-2 pr-2">
						<span :class="`text-xs px-2 py-0.5 rounded-full ${levelBadgeClass(bucket.level)}`">
							L{{ bucket.level }}
						</span>
					</td>
					<td class="py-2 px-2 text-right text-text-secondary">{{ bucket.planned }}</td>
					<td class="py-2 px-2 text-right text-text-primary font-medium">
						{{ bucket.completed }}
					</td>
					<td :class="`py-2 px-2 text-right font-medium ${rateClass(bucket.completionRate)}`">
						{{ formatRate(bucket.completionRate) }}
					</td>
					<td class="py-2 px-2 text-right text-text-secondary">{{ bucket.activeDays }}</td>
					<td class="py-2 px-2 text-right text-text-secondary">{{ bucket.clearedDays }}</td>
					<td :class="`py-2 pl-2 text-right font-medium ${rateClass(bucket.survivalRate)}`">
						{{ formatRate(bucket.survivalRate) }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

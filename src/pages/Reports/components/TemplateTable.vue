<script setup lang="ts">
import type { TemplateBucket } from "@/libs/report/types";
import { formatRate, rateClass } from "../lib";

defineProps<{
	templates: TemplateBucket[];
}>();
</script>

<template>
	<p v-if="templates.length === 0" class="text-text-muted text-sm py-6 text-center">
		No data for this period
	</p>

	<div v-else class="overflow-x-auto scrollbar-hide -mx-1 px-1">
		<table class="w-full text-sm border-collapse min-w-[520px]">
			<thead>
				<tr class="text-text-secondary text-xs">
					<th class="text-left font-medium py-2 pr-2">Task</th>
					<th class="text-right font-medium py-2 px-2">Planned</th>
					<th class="text-right font-medium py-2 px-2">Completed</th>
					<th class="text-right font-medium py-2 px-2">Skipped</th>
					<th class="text-right font-medium py-2 px-2">Overdue</th>
					<th class="text-right font-medium py-2 px-2">Rate</th>
					<th class="text-right font-medium py-2 pl-2">Focus min</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="bucket in templates" :key="bucket.templateId" class="border-t border-border">
					<td class="py-2 pr-2 text-text-primary max-w-[180px] truncate">
						{{ bucket.title }}
					</td>
					<td class="py-2 px-2 text-right text-text-secondary">{{ bucket.planned }}</td>
					<td class="py-2 px-2 text-right text-text-primary font-medium">
						{{ bucket.completed }}
					</td>
					<td class="py-2 px-2 text-right text-text-secondary">{{ bucket.skipped }}</td>
					<td class="py-2 px-2 text-right text-text-secondary">{{ bucket.overdue }}</td>
					<td :class="`py-2 px-2 text-right font-medium ${rateClass(bucket.completionRate)}`">
						{{ formatRate(bucket.completionRate) }}
					</td>
					<td class="py-2 pl-2 text-right text-text-secondary">{{ bucket.focusMinutes }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

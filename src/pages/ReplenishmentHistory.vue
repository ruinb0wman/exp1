<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ArrowUpDown, Loader2, Package } from "lucide-vue-next";
import Header from "@/components/Header.vue";
import { useReplenishmentHistory, useRewardTemplate } from "@/composables/useRewards";

const route = useRoute();
const templateId = computed(() => {
	const id = route.params.templateId;
	return typeof id === "string" ? id : "";
});

const { template, isLoading: isLoadingTemplate } = useRewardTemplate(
	() => templateId.value || null,
);
const { records, isLoading: isLoadingRecords } = useReplenishmentHistory(
	() => templateId.value,
);

const isLoading = computed(() => isLoadingTemplate.value || isLoadingRecords.value);

function formatDateTime(isoString: string | undefined) {
	if (!isoString) return { dateStr: "", timeStr: "" };
	const date = new Date(isoString);
	if (isNaN(date.getTime())) return { dateStr: "", timeStr: "" };
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return { dateStr: `${y}-${m}-${d}`, timeStr: `${h}:${min}` };
}

function formatDateLabel(isoString: string | undefined) {
	if (!isoString) return "Unknown";
	const date = new Date(isoString);
	if (isNaN(date.getTime())) return "Unknown";
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const isToday = date.toDateString() === today.toDateString();
	const isYesterday = date.toDateString() === yesterday.toDateString();

	if (isToday) return "Today";
	if (isYesterday) return "Yesterday";

	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

const grouped = computed(() => {
	const map = new Map<string, typeof records.value>();
	for (const r of records.value) {
		const { dateStr } = formatDateTime(r.createdAt);
		if (!dateStr) continue;
		if (!map.has(dateStr)) map.set(dateStr, []);
		map.get(dateStr)!.push(r);
	}
	return Array.from(map.entries()).map(([dateStr, dayRecords]) => ({
		dateStr,
		dayRecords,
	}));
});

const title = computed(() => template.value?.title ?? "Replenishment History");
</script>

<template>
	<div class="min-h-screen bg-background">
		<Header :title="title" back />

		<!-- 当前库存概览 -->
		<div v-if="template" class="px-4 pt-2 pb-4">
			<div class="rounded-xl bg-surface p-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
						<Package class="w-5 h-5" />
					</div>
					<div>
						<p class="text-text-secondary text-xs">Current Stock</p>
						<p class="text-text-primary text-lg font-bold">
							{{ template.currentStock ?? 0 }}
							<span v-if="template.replenishmentLimit !== undefined" class="text-text-muted text-sm font-normal">
								/ {{ template.replenishmentLimit }}
							</span>
						</p>
					</div>
				</div>
				<div class="text-right">
					<p class="text-text-secondary text-xs">Total Records</p>
					<p class="text-text-primary text-lg font-bold">{{ records.length }}</p>
				</div>
			</div>
		</div>

		<!-- 历史记录列表 -->
		<div class="px-4 pb-8">
			<div v-if="isLoading" class="flex items-center justify-center py-12">
				<Loader2 class="w-6 h-6 text-primary animate-spin" />
			</div>

			<div v-else-if="records.length === 0" class="text-center py-12 text-text-secondary">
				<ArrowUpDown class="w-10 h-10 mx-auto mb-3 opacity-30" />
				<p>No replenishment records yet</p>
				<p
					v-if="template?.replenishmentMode !== 'none'"
					class="text-text-muted text-sm mt-1"
				>
					Records will be created automatically on next restock
				</p>
			</div>

			<div v-else class="flex flex-col gap-4">
				<div v-for="group in grouped" :key="group.dateStr">
					<p class="text-text-muted text-xs font-medium mb-2 sticky top-[var(--spacing-header)] bg-background py-1">
						{{ formatDateLabel(group.dateStr) }}
					</p>
					<div class="flex flex-col gap-2">
						<div
							v-for="record in group.dayRecords"
							:key="record.id"
							class="rounded-xl bg-surface p-4 flex items-center justify-between"
						>
							<div class="flex items-center gap-3">
								<div class="flex flex-col items-center justify-center w-12">
									<span class="text-text-primary text-sm font-bold">
										+{{ record.quantity }}
									</span>
									<span class="text-text-muted text-xs">
										{{ formatDateTime(record.createdAt).timeStr }}
									</span>
								</div>
								<div>
									<p class="text-text-primary text-sm">
										{{ record.reason === "auto" ? "Auto Restock" : "Manual Restock" }}
									</p>
									<p class="text-text-muted text-xs">
										{{ formatDateLabel(record.scheduledDate) }}
									</p>
								</div>
							</div>
							<span
								:class="`text-xs px-2 py-1 rounded-full ${
									record.reason === 'auto'
										? 'bg-primary/10 text-primary'
										: 'bg-green-500/10 text-green-500'
								}`"
							>
								{{ record.reason === "auto" ? "AUTO" : "MANUAL" }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

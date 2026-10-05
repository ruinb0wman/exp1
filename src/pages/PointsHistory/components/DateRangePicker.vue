<script setup lang="ts">
import { ref } from "vue";
import { ChevronDown } from "lucide-vue-next";

const props = defineProps<{
	startDate: string;
	endDate: string;
}>();

const emit = defineEmits<{ change: [start: string, end: string] }>();

const isOpen = ref(false);

function formatDisplayDate(dateStr: string) {
	const date = new Date(dateStr);
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

function handleQuickSelect(days: number) {
	const now = new Date();
	// 使用UTC时间计算日期范围
	const endUTC = now.toISOString();
	const startUTC = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - days,
			0,
			0,
			0,
			0,
		),
	).toISOString();
	emit("change", startUTC, endUTC);
	isOpen.value = false;
}

const quickOptions = [
	{ label: "Last 7 days", days: 7 },
	{ label: "Last 30 days", days: 30 },
	{ label: "Last 90 days", days: 90 },
];
</script>

<template>
	<div class="relative">
		<button
			class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary text-sm hover:bg-surface-light transition-colors"
			@click="isOpen = !isOpen"
		>
			<span>{{ formatDisplayDate(props.startDate) }} - {{ formatDisplayDate(props.endDate) }}</span>
			<ChevronDown :class="`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`" />
		</button>

		<template v-if="isOpen">
			<div class="fixed inset-0 z-40" @click="isOpen = false" />
			<div class="absolute top-full right-0 mt-2 w-48 rounded-xl bg-surface border border-border shadow-lg z-50 py-1">
				<button
					v-for="item in quickOptions"
					:key="item.days"
					class="w-full px-4 py-2 text-left text-text-primary hover:bg-surface-light transition-colors text-sm"
					@click="handleQuickSelect(item.days)"
				>
					{{ item.label }}
				</button>
			</div>
		</template>
	</div>
</template>

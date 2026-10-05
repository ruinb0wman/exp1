<script setup lang="ts">
import { computed } from "vue";
import { Banknote, ReceiptText, Sparkles } from "lucide-vue-next";
import type { RewardPurchaseStats } from "@/db/services";
import { formatMoney } from "@/libs/reward";

const props = defineProps<{
	stats: RewardPurchaseStats;
}>();

const cards = computed(() => [
	{
		key: "points",
		icon: Sparkles,
		value: props.stats.pointsSpent.toLocaleString(),
		label: "Points spent",
		tone: "text-primary",
		bg: "bg-primary/20",
	},
	{
		key: "money",
		icon: Banknote,
		value: formatMoney(props.stats.moneyAmount),
		label: "Money value",
		tone: "text-green-400",
		bg: "bg-green-500/20",
	},
	{
		key: "count",
		icon: ReceiptText,
		value: props.stats.count.toLocaleString(),
		label: `${props.stats.quantity} items`,
		tone: "text-text-primary",
		bg: "bg-surface-light",
	},
]);
</script>

<template>
	<div class="grid grid-cols-3 gap-3">
		<div
			v-for="card in cards"
			:key="card.key"
			class="rounded-xl bg-surface border border-border p-4 flex flex-col items-center gap-2"
		>
			<div :class="`w-9 h-9 rounded-lg flex items-center justify-center ${card.bg} ${card.tone}`">
				<component :is="card.icon" class="w-4 h-4" />
			</div>
			<p :class="`text-lg font-bold ${card.tone}`">{{ card.value }}</p>
			<p class="text-text-muted text-xs text-center leading-tight">{{ card.label }}</p>
		</div>
	</div>
</template>

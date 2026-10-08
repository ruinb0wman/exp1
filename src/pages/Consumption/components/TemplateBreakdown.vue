<script setup lang="ts">
import { Package } from "lucide-vue-next";
import DynamicIcon from "@/components/DynamicIcon.vue";
import EmptyState from "@/components/EmptyState.vue";
import type { PurchaseTemplateBucket } from "@/db/services";
import { formatMoney } from "@/libs/reward";
import { formatPercent, getMoneySharePercent } from "../lib";

defineProps<{
	buckets: PurchaseTemplateBucket[];
	/** 周期内计入统计的消费总额（元），作为占比分母 */
	totalMoney: number;
	/** 当前选中的奖品（与记录区分组联动） */
	selectedId?: string | null;
}>();

const emit = defineEmits<{ select: [templateId: string] }>();
</script>

<template>
	<EmptyState
		v-if="buckets.length === 0"
		title="No spending in this period"
	>
		<Package class="w-8 h-8" />
	</EmptyState>

	<div v-else class="rounded-xl bg-surface p-4 border border-border space-y-4">
		<div v-for="bucket in buckets" :key="bucket.templateId" class="space-y-2">
			<button
				class="w-full flex items-center gap-3 text-left rounded-lg transition-colors"
				:class="{ 'ring-1 ring-primary': selectedId === bucket.templateId }"
				@click="emit('select', bucket.templateId)"
			>
				<div
					class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
					:style="{ backgroundColor: `${bucket.iconColor ?? '#f56565'}20` }"
				>
					<DynamicIcon
						:name="bucket.icon"
						:color="bucket.iconColor ?? '#f56565'"
						class="w-4 h-4"
					/>
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-text-primary font-medium truncate">{{ bucket.title }}</p>
					<p class="text-text-muted text-xs">
						{{ `${bucket.count} purchases · ${bucket.quantity} items` }}
					</p>
				</div>
				<div class="text-right shrink-0">
					<p class="text-primary font-bold">{{ bucket.pointsSpent.toLocaleString() }}</p>
					<p class="text-xs">
						<span class="text-green-400">{{ formatMoney(bucket.moneyAmount) }}</span>
						<span class="text-text-secondary ml-2">
							{{ formatPercent(getMoneySharePercent(bucket.moneyAmount, totalMoney)) }}
						</span>
					</p>
				</div>
			</button>
			<div class="h-1.5 rounded-full bg-surface-light overflow-hidden">
				<div
					class="h-full rounded-full transition-all"
					:style="{
						width: `${getMoneySharePercent(bucket.moneyAmount, totalMoney)}%`,
						backgroundColor: bucket.iconColor ?? '#f56565',
					}"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Package, Sparkles } from "lucide-vue-next";
import DynamicIcon from "@/components/DynamicIcon.vue";
import EmptyState from "@/components/EmptyState.vue";
import { formatMoney, isCountedInConsumption } from "@/libs/reward";
import type { StoreReward } from "@/composables/useRewards";

defineProps<{
	rewards: StoreReward[];
	isLoading: boolean;
}>();

const emit = defineEmits<{ rewardClick: [reward: StoreReward] }>();
</script>

<template>
	<div v-if="isLoading" class="flex items-center justify-center py-12">
		<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
	</div>

	<EmptyState
		v-else-if="rewards.length === 0"
		title="No Rewards"
		description="Tap + to create a new reward"
	>
		<Package class="w-8 h-8" />
	</EmptyState>

	<div v-else class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(100px,1fr))]">
		<button
			v-for="{ template, availableCount } in rewards"
			:key="template.id"
			class="flex flex-col gap-2 text-left group"
			@click="emit('rewardClick', { template, availableCount })"
		>
			<div
				class="w-full aspect-square rounded-xl flex items-center justify-center transition-transform group-active:scale-95"
				:style="{ backgroundColor: `${template.iconColor ?? '#f56565'}20` }"
			>
				<DynamicIcon
					:name="template.icon"
					:color="template.iconColor ?? '#f56565'"
					class="w-16 h-16"
				/>
			</div>
			<div>
				<p class="text-text-primary text-base font-medium truncate">
					{{ template.title }}
				</p>
				<div class="flex items-center gap-2">
					<Sparkles class="w-3 h-3 text-primary" />
					<p class="text-text-secondary text-sm">{{ template.pointsCost }} exp</p>
					<p v-if="isCountedInConsumption(template.countInConsumption)" class="text-green-400 text-xs">
						{{ formatMoney(template.moneyCost) }}
					</p>
				</div>
				<p
					v-if="template.replenishmentMode !== 'none' && availableCount > 0"
					class="text-text-muted text-xs mt-0.5"
				>
					{{ `${availableCount} left` }}
				</p>
			</div>
		</button>
	</div>
</template>

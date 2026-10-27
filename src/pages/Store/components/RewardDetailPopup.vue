<script setup lang="ts">
import { computed } from "vue";
import { Banknote, Sparkles } from "@lucide/vue";
import { RInputNumber } from "@ruinb0w/ui";
import DynamicIcon from "@/components/DynamicIcon.vue";
import {
	formatMoney,
	isCountedInConsumption,
	MAX_PURCHASE_NOTE_LENGTH,
} from "@/libs/reward";
import type { StoreReward } from "@/composables/useRewards";
import { getPurchaseMoney } from "../lib";

const props = defineProps<{
	reward: StoreReward;
	quantity: number;
	note: string;
	maxQuantity: number;
	currentPoints: number;
	isActionLoading: boolean;
	redeemError: string | null;
}>();

const emit = defineEmits<{
	"update:quantity": [quantity: number];
	"update:note": [note: string];
	redeem: [];
}>();

const totalCost = computed(
	() => props.reward.template.pointsCost * props.quantity,
);
const purchaseMoney = computed(() =>
	getPurchaseMoney(props.reward.template, props.quantity),
);
// 关闭「计入消费统计」的奖品不折合金额，也不计入消费统计
const counted = computed(() =>
	isCountedInConsumption(props.reward.template.countInConsumption),
);
const canRedeem = computed(
	() =>
		!props.isActionLoading &&
		props.currentPoints >= totalCost.value &&
		(props.reward.template.replenishmentMode === "none" ||
			props.reward.availableCount >= props.quantity),
);

function handleNoteInput(event: Event) {
	emit("update:note", (event.target as HTMLTextAreaElement).value);
}

const notEnoughQuota = computed(
	() =>
		props.reward.template.replenishmentMode !== "none" &&
		props.reward.availableCount < props.quantity,
);
</script>

<template>
	<div class="space-y-6 py-2">
		<div class="flex flex-col items-center gap-4">
			<div
				class="w-24 h-24 rounded-2xl flex items-center justify-center"
				:style="{ backgroundColor: `${reward.template.iconColor ?? '#f56565'}20` }"
			>
				<DynamicIcon
					:name="reward.template.icon"
					:color="reward.template.iconColor ?? '#f56565'"
					class="w-12 h-12"
				/>
			</div>
			<div class="text-center">
				<h3 class="text-xl font-bold text-text-primary">
					{{ reward.template.title }}
				</h3>
				<p v-if="reward.template.description" class="text-text-secondary text-sm mt-1">
					{{ reward.template.description }}
				</p>
			</div>
		</div>

		<div :class="`grid gap-3 ${counted ? 'grid-cols-2' : 'grid-cols-1'}`">
			<div class="bg-surface rounded-xl p-4 text-center">
				<div class="flex items-center justify-center gap-1 text-primary mb-1">
					<Sparkles class="w-4 h-4" />
					<span class="text-lg font-bold">{{ reward.template.pointsCost }}</span>
				</div>
				<p class="text-text-muted text-xs">exp</p>
			</div>
			<div v-if="counted" class="bg-surface rounded-xl p-4 text-center">
				<div class="flex items-center justify-center gap-1 text-green-400 mb-1">
					<Banknote class="w-4 h-4" />
					<span class="text-lg font-bold">{{ formatMoney(purchaseMoney) }}</span>
				</div>
				<p class="text-text-muted text-xs">Money value</p>
			</div>
		</div>

		<div v-if="reward.template.replenishmentMode !== 'none'" class="bg-surface rounded-xl p-4">
			<div class="flex items-center justify-between">
				<span class="text-text-secondary text-sm">Remaining quota</span>
				<span class="text-text-primary font-medium">
					{{ reward.availableCount }} items
				</span>
			</div>
			<div
				v-if="reward.template.replenishmentLimit !== undefined"
				class="flex items-center justify-between mt-2"
			>
				<span class="text-text-secondary text-sm">Quota limit</span>
				<span class="text-text-primary font-medium">
					{{ reward.template.replenishmentLimit }} items
				</span>
			</div>
		</div>

		<div class="bg-surface rounded-xl p-4">
			<div class="flex items-center justify-between mb-3">
				<span class="text-text-secondary text-sm">Quantity</span>
				<RInputNumber
					:model-value="quantity"
					:min="1"
					:max="maxQuantity"
					:allow-decimal="false"
					:value-on-clear="1"
					@update:model-value="(v) => emit('update:quantity', v ?? 1)"
				/>
			</div>
			<div class="flex items-center justify-between pt-3 border-t border-border">
				<span class="text-text-secondary text-sm">Total</span>
				<span class="text-primary font-bold text-lg">
					{{ totalCost.toLocaleString() }} exp
					<span v-if="counted" class="text-text-secondary font-normal text-sm ml-2">
						≈ {{ formatMoney(purchaseMoney) }}
					</span>
				</span>
			</div>
		</div>

		<div class="bg-surface rounded-xl p-4">
			<div class="flex items-center justify-between pb-2">
				<span class="text-text-secondary text-sm">Note (optional)</span>
				<span class="text-text-muted text-xs">
					{{ note.length }}/{{ MAX_PURCHASE_NOTE_LENGTH }}
				</span>
			</div>
			<textarea
				:value="note"
				:maxlength="MAX_PURCHASE_NOTE_LENGTH"
				rows="2"
				placeholder="e.g. with friends / weekend treat"
				class="w-full min-w-0 resize-none rounded-lg text-text-primary placeholder:text-text-muted bg-surface-light p-3 text-base font-normal leading-normal focus:outline-none focus:ring-2 focus:ring-primary"
				@input="handleNoteInput"
			/>
		</div>

		<p v-if="redeemError" class="text-primary text-sm text-center">{{ redeemError }}</p>

		<button
			:disabled="!canRedeem"
			class="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			@click="emit('redeem')"
		>
			<div
				v-if="isActionLoading"
				class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"
			/>
			<template v-else-if="notEnoughQuota">Not enough quota</template>
			<template v-else-if="currentPoints < totalCost">Not enough points</template>
			<template v-else>{{ `Buy ${quantity}` }}</template>
		</button>
	</div>
</template>

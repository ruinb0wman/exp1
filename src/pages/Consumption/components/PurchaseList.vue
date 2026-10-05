<script setup lang="ts">
import { ref } from "vue";
import { ReceiptText, Trash2 } from "lucide-vue-next";
import DynamicIcon from "@/components/DynamicIcon.vue";
import EmptyState from "@/components/EmptyState.vue";
import { useConfirm } from "@/composables/useConfirm";
import type { RewardPurchase } from "@/db/types";
import { formatMoney, isCountedInConsumption } from "@/libs/reward";
import { formatPurchaseDateTime } from "../lib";

defineProps<{
	purchases: RewardPurchase[];
}>();

const emit = defineEmits<{ delete: [purchaseId: string] }>();

const confirmDialog = useConfirm();
const deletingId = ref<string | null>(null);

async function handleDelete(purchase: RewardPurchase) {
	const ok = await confirmDialog({
		title: "Delete",
		message: `Delete the "${purchase.template.title}" purchase? ${purchase.pointsSpent} points and the matching quota will be refunded.`,
		confirmLabel: "Delete",
		variant: "danger",
	});
	if (!ok) return;

	deletingId.value = purchase.id;
	try {
		emit("delete", purchase.id);
	} finally {
		deletingId.value = null;
	}
}
</script>

<template>
	<EmptyState
		v-if="purchases.length === 0"
		title="No spending in this period"
	>
		<ReceiptText class="w-8 h-8" />
	</EmptyState>

	<div v-else class="flex flex-col gap-2">
		<div
			v-for="purchase in purchases"
			:key="purchase.id"
			class="flex items-center gap-3 rounded-xl bg-surface border border-border p-3"
		>
			<div
				class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
				:style="{ backgroundColor: `${purchase.template.iconColor ?? '#f56565'}20` }"
			>
				<DynamicIcon
					:name="purchase.template.icon"
					:color="purchase.template.iconColor ?? '#f56565'"
					class="w-5 h-5"
				/>
			</div>

			<div class="flex-1 min-w-0">
				<p class="text-text-primary font-medium truncate">
					{{ purchase.template.title }}
					<span v-if="purchase.quantity > 1" class="text-text-secondary font-normal">
						×{{ purchase.quantity }}
					</span>
				</p>
				<p class="text-text-muted text-xs">
					{{ formatPurchaseDateTime(purchase.createdAt) }}
				</p>
				<p
					v-if="purchase.note"
					class="text-text-secondary text-xs mt-0.5 whitespace-pre-line break-words"
				>
					{{ purchase.note }}
				</p>
			</div>

			<div class="text-right shrink-0">
				<!-- 0 积分（免费额度）不显示负号，避免出现 "-0" -->
				<p :class="purchase.pointsSpent > 0 ? 'text-primary font-bold' : 'text-text-muted font-bold'">
					{{ purchase.pointsSpent > 0 ? `-${purchase.pointsSpent}` : "0" }}
				</p>
				<p
					v-if="isCountedInConsumption(purchase.template.countInConsumption)"
					class="text-green-400 text-xs"
				>
					{{ formatMoney(purchase.moneyAmount ?? 0) }}
				</p>
				<p v-else class="text-text-muted text-xs">Not counted</p>
			</div>

			<button
				:disabled="deletingId === purchase.id"
				aria-label="Delete"
				class="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-primary hover:bg-surface-light transition-colors disabled:opacity-40"
				@click="handleDelete(purchase)"
			>
				<div
					v-if="deletingId === purchase.id"
					class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
				/>
				<Trash2 v-else class="w-4 h-4" />
			</button>
		</div>
	</div>
</template>

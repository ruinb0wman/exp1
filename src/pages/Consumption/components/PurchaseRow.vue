<script setup lang="ts">
import { ref } from "vue";
import { Trash2 } from "lucide-vue-next";
import DynamicIcon from "@/components/DynamicIcon.vue";
import { useConfirm } from "@/composables/useConfirm";
import type { RewardPurchase } from "@/db/types";
import { formatMoney, isCountedInConsumption } from "@/libs/reward";
import { formatPurchaseDateTime } from "../lib";

const props = defineProps<{
	purchase: RewardPurchase;
}>();

const emit = defineEmits<{ delete: [purchaseId: string] }>();

const confirmDialog = useConfirm();
const deletingId = ref<string | null>(null);

async function handleDelete() {
	const purchase = props.purchase;
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
	<div class="flex items-center gap-3 rounded-xl bg-surface-light p-3">
		<div
			class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
			:style="{ backgroundColor: `${props.purchase.template.iconColor ?? '#f56565'}20` }"
		>
			<DynamicIcon
				:name="props.purchase.template.icon"
				:color="props.purchase.template.iconColor ?? '#f56565'"
				class="w-4 h-4"
			/>
		</div>

		<div class="flex-1 min-w-0">
			<p class="text-text-muted text-xs">
				{{ formatPurchaseDateTime(props.purchase.createdAt) }}
				<span v-if="props.purchase.quantity > 1" class="text-text-secondary">
					· ×{{ props.purchase.quantity }}
				</span>
			</p>
			<p v-if="props.purchase.note" class="text-text-secondary text-xs mt-0.5 whitespace-pre-line break-words">
				{{ props.purchase.note }}
			</p>
		</div>

		<div class="text-right shrink-0">
			<!-- 0 积分（免费额度）不显示负号，避免出现 "-0" -->
			<p :class="props.purchase.pointsSpent > 0 ? 'text-primary font-bold' : 'text-text-muted font-bold'">
				{{ props.purchase.pointsSpent > 0 ? `-${props.purchase.pointsSpent}` : "0" }}
			</p>
			<p
				v-if="isCountedInConsumption(props.purchase.template.countInConsumption)"
				class="text-green-400 text-xs"
			>
				{{ formatMoney(props.purchase.moneyAmount ?? 0) }}
			</p>
			<p v-else class="text-text-muted text-xs">Not counted</p>
		</div>

		<button
			:disabled="deletingId === props.purchase.id"
			aria-label="Delete"
			class="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-primary hover:bg-surface transition-colors disabled:opacity-40"
			@click="handleDelete"
		>
			<div
				v-if="deletingId === props.purchase.id"
				class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
			/>
			<Trash2 v-else class="w-4 h-4" />
		</button>
	</div>
</template>

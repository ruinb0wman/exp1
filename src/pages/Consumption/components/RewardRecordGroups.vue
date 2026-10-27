<script setup lang="ts">
import { ref } from "vue";
import { ChevronDown, ReceiptText } from "@lucide/vue";
import DynamicIcon from "@/components/DynamicIcon.vue";
import { REmptyState } from "@ruinb0w/ui";
import { formatMoney } from "@/libs/reward";
import type { RewardRecordGroup } from "../lib";
import PurchaseRow from "./PurchaseRow.vue";

const props = defineProps<{
	groups: RewardRecordGroup[];
}>();

const emit = defineEmits<{ delete: [purchaseId: string] }>();

/** 展开的组 id；不在集合里 = 默认折叠 */
const expanded = ref(new Set<string>());

function isExpanded(templateId: string): boolean {
	return expanded.value.has(templateId);
}

function toggle(templateId: string) {
	// 替换整个 Set，避免依赖 Set 的响应式追踪
	const next = new Set(expanded.value);
	if (next.has(templateId)) next.delete(templateId);
	else next.add(templateId);
	expanded.value = next;
}
</script>

<template>
	<REmptyState v-if="props.groups.length === 0" title="No spending in this period">
		<ReceiptText class="w-8 h-8" />
	</REmptyState>

	<div v-else class="flex flex-col gap-3">
		<div
			v-for="group in props.groups"
			:key="group.templateId"
			:data-record-group="group.templateId"
			class="rounded-xl bg-surface border border-border overflow-hidden"
		>
			<button
				class="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-light transition-colors"
				:aria-expanded="isExpanded(group.templateId)"
				@click="toggle(group.templateId)"
			>
				<div
					class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
					:style="{ backgroundColor: `${group.iconColor ?? '#f56565'}20` }"
				>
					<DynamicIcon
						:name="group.icon"
						:color="group.iconColor ?? '#f56565'"
						class="w-4 h-4"
					/>
				</div>

				<div class="flex-1 min-w-0">
					<p class="text-text-primary font-medium truncate">{{ group.title }}</p>
					<p class="text-text-muted text-xs">
						{{ `${group.count} purchases · ${group.quantity} items` }}
						<span v-if="group.uncountedCount > 0" class="text-text-secondary">
							· {{ group.uncountedCount }} not counted
						</span>
					</p>
				</div>

				<div class="text-right shrink-0">
					<p class="text-primary font-bold">{{ group.pointsSpent.toLocaleString() }}</p>
					<p class="text-green-400 text-xs">{{ formatMoney(group.moneyAmount) }}</p>
				</div>

				<ChevronDown
					class="w-4 h-4 shrink-0 text-text-muted transition-transform"
					:class="{ '-rotate-90': !isExpanded(group.templateId) }"
				/>
			</button>

			<div v-if="isExpanded(group.templateId)" class="px-3 pt-2 pb-3 flex flex-col gap-2">
				<PurchaseRow
					v-for="purchase in group.records"
					:key="purchase.id"
					:purchase="purchase"
					@delete="(id) => emit('delete', id)"
				/>
			</div>
		</div>
	</div>
</template>

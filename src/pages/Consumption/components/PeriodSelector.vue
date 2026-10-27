<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { RChipGroup, RMobileDatePicker } from "@ruinb0w/ui";
import type { PurchaseScope } from "@/composables/useRewardPurchases";
import { PURCHASE_SCOPES, formatAnchorLabel, shiftAnchor } from "../lib";

const SCOPE_LABEL: Record<PurchaseScope, string> = {
	month: "Month",
	year: "Year",
	custom: "Custom",
};

const props = defineProps<{
	scope: PurchaseScope;
	/** 锚点日期（月/年所属周期） */
	anchor: Date;
	customStart: Date;
	customEnd: Date;
}>();

const emit = defineEmits<{
	scopeChange: [scope: PurchaseScope];
	anchorChange: [date: Date];
	customRangeChange: [start: Date, end: Date];
}>();
</script>

<template>
	<div class="mb-4">
		<RChipGroup
			:options="PURCHASE_SCOPES.map((o) => ({ label: SCOPE_LABEL[o], value: o }))"
			:model-value="scope"
			@change="(v) => emit('scopeChange', v as PurchaseScope)"
		/>

		<div v-if="scope === 'custom'" class="flex items-center gap-3">
			<div class="flex-1">
				<p class="text-text-secondary text-xs mb-1">Start date</p>
				<RMobileDatePicker
					:model-value="customStart"
					:max-date="customEnd"
					:week-starts-on="1"
					@change="(date: Date | null) => date && emit('customRangeChange', date, customEnd)"
				/>
			</div>
			<div class="flex-1">
				<p class="text-text-secondary text-xs mb-1">End date</p>
				<RMobileDatePicker
					:model-value="customEnd"
					:min-date="customStart"
					:week-starts-on="1"
					@change="(date: Date | null) => date && emit('customRangeChange', customStart, date)"
				/>
			</div>
		</div>

		<div v-else class="flex items-center justify-between gap-2">
			<button
				aria-label="Previous"
				class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
				@click="emit('anchorChange', shiftAnchor(scope, anchor, -1))"
			>
				<ChevronLeft class="w-5 h-5" />
			</button>

			<div class="flex-1 text-center">
				<button
					class="text-text-primary font-bold hover:text-primary transition-colors"
					@click="emit('anchorChange', new Date())"
				>
					{{ formatAnchorLabel(scope, anchor) }}
				</button>
				<p class="text-text-muted text-xs mt-0.5">Back to today</p>
			</div>

			<button
				aria-label="Next"
				class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
				@click="emit('anchorChange', shiftAnchor(scope, anchor, 1))"
			>
				<ChevronRight class="w-5 h-5" />
			</button>
		</div>
	</div>
</template>

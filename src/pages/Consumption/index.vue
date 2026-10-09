<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { BarChart3 } from "lucide-vue-next";
import Header from "@/components/Header.vue";
import FilterTabs from "@/components/FilterTabs.vue";
import EmptyState from "@/components/EmptyState.vue";
import ErrorState from "@/components/ErrorState.vue";
import LoadingState from "@/components/LoadingState.vue";
import { useUserStore } from "@/store";
import {
	useRewardPurchaseActions,
	useRewardPurchaseStats,
	type PurchaseScope,
} from "@/composables/useRewardPurchases";
import { formatLocalDate } from "@/libs/time";
import PeriodSelector from "./components/PeriodSelector.vue";
import SummaryCards from "./components/SummaryCards.vue";
import RewardRecordGroups from "./components/RewardRecordGroups.vue";
import { groupPurchasesByReward, REWARD_RECORD_SORTS, type RewardRecordSortKey } from "./lib";

/**
 * 消费统计页：月/年/自定义的消费积分、折合金额与兑换记录
 * 购买即消费，明细可删除并回滚积分与消费额度
 *
 * 兑换记录按奖品分组（折叠展开），所以不需要再单独做一份按奖品筛选的入口
 */
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const scope = ref<PurchaseScope>("month");
const anchor = ref<Date>(new Date());
/** 兑换记录排序口径，默认按折合金额 */
const sortBy = ref<RewardRecordSortKey>("money");
const customStart = ref<Date>(
	(() => {
		const date = new Date();
		date.setDate(date.getDate() - 29);
		return date;
	})(),
);
const customEnd = ref<Date>(new Date());

const anchorStr = computed(() => formatLocalDate(anchor.value));
const customStartStr = computed(() => formatLocalDate(customStart.value));
const customEndStr = computed(() => formatLocalDate(customEnd.value));

const { stats, period, isLoading, error, refresh } = useRewardPurchaseStats({
	userId: () => user.value?.id ?? null,
	scope,
	anchor: anchorStr,
	customStart: customStartStr,
	customEnd: customEndStr,
});
const { remove } = useRewardPurchaseActions();

/** 按奖品分组的兑换记录（含不计入消费统计的） */
const groups = computed(() =>
	stats.value ? groupPurchasesByReward(stats.value.purchases, sortBy.value) : [],
);

const SORT_LABEL: Record<RewardRecordSortKey, string> = {
	money: "By money",
	points: "By points",
};

function handleCustomRangeChange(start: Date, end: Date) {
	customStart.value = start;
	customEnd.value = end;
}

async function handleDelete(purchaseId: string) {
	await remove(purchaseId);
	// 积分余额、消费统计同步刷新
	await userStore.calculatePoints();
	await refresh();
}

const rangeText = computed(() => {
	if (!period.value) return "";
	const partial = period.value.isPartial ? ` (up to ${period.value.end})` : "";
	return `${period.value.start} ~ ${period.value.end}${partial}`;
});
</script>

<template>
	<div class="min-h-screen bg-background">
		<Header title="Spending" back />

		<main class="px-4 pb-24">
			<EmptyState v-if="!user" title="Spending">
				<BarChart3 class="w-8 h-8" />
			</EmptyState>

			<template v-else>
				<p class="text-text-muted text-xs mb-4">
					Buying is spending — points and money totals by item and period
				</p>

				<PeriodSelector
					:scope="scope"
					:anchor="anchor"
					:custom-start="customStart"
					:custom-end="customEnd"
					@scope-change="(s) => (scope = s)"
					@anchor-change="(d) => (anchor = d)"
					@custom-range-change="handleCustomRangeChange"
				/>

				<LoadingState v-if="isLoading && !stats" message="Loading..." />

				<ErrorState
					v-else-if="error"
					:title="error"
					retry-label="Retry"
					@retry="refresh"
				/>

				<div v-else-if="stats" class="space-y-6">
					<p class="text-text-secondary text-sm">
						<span class="text-text-muted mr-2">Range</span>
						{{ rangeText }}
					</p>

					<SummaryCards :stats="stats" />

					<section>
						<h2 class="text-text-primary font-bold mb-3">Records by reward</h2>
						<FilterTabs
							:options="REWARD_RECORD_SORTS"
							:active-filter="sortBy"
							@change="(s) => (sortBy = s)"
						>
							<template #label="{ option }">{{ SORT_LABEL[option] }}</template>
						</FilterTabs>
						<RewardRecordGroups :groups="groups" @delete="handleDelete" />
					</section>
				</div>
			</template>
		</main>
	</div>
</template>

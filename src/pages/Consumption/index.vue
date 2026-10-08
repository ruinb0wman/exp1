<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { storeToRefs } from "pinia";
import { BarChart3 } from "lucide-vue-next";
import Header from "@/components/Header.vue";
import DynamicIcon from "@/components/DynamicIcon.vue";
import EmptyState from "@/components/EmptyState.vue";
import ErrorState from "@/components/ErrorState.vue";
import FilterTabs from "@/components/FilterTabs.vue";
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
import TemplateBreakdown from "./components/TemplateBreakdown.vue";
import RewardRecordGroups from "./components/RewardRecordGroups.vue";
import { groupPurchasesByReward, type RewardRecordGroup } from "./lib";

/**
 * 消费统计页：月/年/自定义的消费积分、折合金额、商品占比与明细
 * 购买即消费，明细可删除并回滚积分与消费额度
 *
 * 明细按奖品（= 分类）分组展示，可从 By item 或筛选 chip 下钻到单个奖品的兑换记录
 */
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const scope = ref<PurchaseScope>("month");
const anchor = ref<Date>(new Date());
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

/** 选中的奖品 ID（null = 全部） */
const selectedTemplateId = ref<string | null>(null);

const groups = computed<RewardRecordGroup[]>(() =>
	stats.value ? groupPurchasesByReward(stats.value.purchases) : [],
);

const groupByTemplateId = computed(
	() => new Map(groups.value.map((group) => [group.templateId, group])),
);

/**
 * 周期切换后选中的奖品可能不在本期 → 兜底回退「全部」（纯计算，不写 watch）
 */
const activeTemplateId = computed(() =>
	selectedTemplateId.value && groupByTemplateId.value.has(selectedTemplateId.value)
		? selectedTemplateId.value
		: null,
);

const visibleGroups = computed(() =>
	activeTemplateId.value
		? groups.value.filter((group) => group.templateId === activeTemplateId.value)
		: groups.value,
);

/** 筛选 chip：全部 + 本周期出现过的奖品 */
const rewardFilterOptions = computed(() => [
	"all",
	...groups.value.map((group) => group.templateId),
]);

function groupFor(templateId: string): RewardRecordGroup | undefined {
	return groupByTemplateId.value.get(templateId);
}

/** 选中某个奖品并滚动到它的分组 */
async function selectReward(templateId: string) {
	selectedTemplateId.value = templateId;
	await nextTick();
	document
		.querySelector(`[data-record-group="${templateId}"]`)
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleFilterChange(option: string) {
	if (option === "all") {
		selectedTemplateId.value = null;
		return;
	}
	void selectReward(option);
}

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
						<div class="flex items-baseline justify-between mb-3">
							<h2 class="text-text-primary font-bold">By item</h2>
							<span class="text-text-muted text-xs">Tap an item to see its records</span>
						</div>
						<TemplateBreakdown
							:buckets="stats.byTemplate"
							:total-money="stats.moneyAmount"
							:selected-id="activeTemplateId"
							@select="selectReward"
						/>
					</section>

					<section>
						<h2 class="text-text-primary font-bold mb-3">Records by reward</h2>
						<FilterTabs
							:options="rewardFilterOptions"
							:active-filter="activeTemplateId ?? 'all'"
							@change="handleFilterChange"
						>
							<template #label="{ option }">
								<span class="flex items-center gap-2">
									<DynamicIcon
										v-if="option !== 'all'"
										:name="groupFor(option)?.icon ?? 'Gift'"
										:color="groupFor(option)?.iconColor ?? '#f56565'"
										class="w-4 h-4"
									/>
									{{ option === "all" ? "All" : (groupFor(option)?.title ?? "") }}
								</span>
							</template>
						</FilterTabs>

						<RewardRecordGroups
							:groups="visibleGroups"
							:expanded-template-id="activeTemplateId"
							@delete="handleDelete"
						/>
					</section>
				</div>
			</template>
		</main>
	</div>
</template>

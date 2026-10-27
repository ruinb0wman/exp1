<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { ChartPie, History, ListChecks, Pencil, Plus } from "@lucide/vue";
import Header from "@/components/Header.vue";
import HeaderActionButton from "@/components/HeaderActionButton.vue";
import { RModal } from "@ruinb0w/ui";
import { useUserStore } from "@/store";
import { useStoreRewards, type StoreReward } from "@/composables/useRewards";
import { useRewardPurchaseActions } from "@/composables/useRewardPurchases";
import {
	getTemplatesNeedingReplenishment,
	replenishRewardTemplate,
} from "@/db/services/rewardService";
import PointsCard from "./components/PointsCard.vue";
import SearchBar from "./components/SearchBar.vue";
import RewardsGrid from "./components/RewardsGrid.vue";
import RewardDetailPopup from "./components/RewardDetailPopup.vue";
import { filterRewardsBySearch, getMaxQuantity } from "./lib";

const router = useRouter();
const userStore = useUserStore();
const { user, currentPoints } = storeToRefs(userStore);

const {
	rewards,
	isLoading,
	refresh,
} = useStoreRewards(() => user.value?.id);

// 防止补货并发执行的锁
let isReplenishing = false;

const searchQuery = ref("");
const selectedReward = ref<StoreReward | null>(null);
const isPopupOpen = ref(false);
const redeemError = ref<string | null>(null);
const redeemQuantity = ref(1);
const redeemNote = ref("");

const { purchase, isLoading: isActionLoading } = useRewardPurchaseActions();

// 搜索过滤
const filteredRewards = computed(() =>
	filterRewardsBySearch(rewards.value, searchQuery.value),
);

// 计算最大可兑换数量
const maxQuantity = computed(() =>
	getMaxQuantity(selectedReward.value, currentPoints.value),
);

// 进入页面时重新计算积分 + 检查补货
onMounted(async () => {
	void userStore.calculatePoints();

	const id = user.value?.id;
	if (!id || isReplenishing) return;

	isReplenishing = true;
	try {
		const templates = await getTemplatesNeedingReplenishment(
			id,
			user.value?.dayEndTime ?? "00:00",
		);
		for (const { template, missedDays } of templates) {
			await replenishRewardTemplate(template.id!, missedDays);
		}
		if (templates.length > 0) {
			await refresh();
		}
	} catch (err) {
		console.error("Replenishment failed:", err);
	} finally {
		isReplenishing = false;
	}
});

// 处理奖励点击
function handleRewardClick(reward: StoreReward) {
	selectedReward.value = reward;
	redeemError.value = null;
	redeemQuantity.value = 1;
	redeemNote.value = "";
	isPopupOpen.value = true;
}

// 处理购买（购买即消费）
async function handlePurchase() {
	if (!selectedReward.value || !user.value) return;

	const { template, availableCount } = selectedReward.value;
	const totalCost = template.pointsCost * redeemQuantity.value;

	// 检查消费额度
	if (
		template.replenishmentMode !== "none" &&
		availableCount < redeemQuantity.value
	) {
		redeemError.value = "Not enough quota";
		return;
	}

	// 检查积分是否足够
	if (currentPoints.value < totalCost) {
		redeemError.value = "Not enough points";
		return;
	}

	try {
		// 扣积分、写消费记录、扣额度在服务层同一事务内完成
		await purchase(
			template.id!,
			user.value.id,
			redeemQuantity.value,
			redeemNote.value,
		);

		// 刷新商店列表（额度已变化）与积分余额
		await refresh();
		await userStore.calculatePoints();

		// 关闭 popup
		isPopupOpen.value = false;
		selectedReward.value = null;
		redeemQuantity.value = 1;
		redeemNote.value = "";
	} catch (err) {
		redeemError.value = err instanceof Error ? err.message : "Error";
	}
}

function goToReplenishment() {
	if (!selectedReward.value) return;
	const id = selectedReward.value.template.id;
	isPopupOpen.value = false;
	router.push(`/replenishment/${id}`);
}

function goToEditReward() {
	if (!selectedReward.value) return;
	const id = selectedReward.value.template.id;
	isPopupOpen.value = false;
	router.push(`/rewards/${id}`);
}
</script>

<template>
	<div class="min-h-screen pb-24 bg-background">
		<!-- Header -->
		<div class="sticky top-0 z-10 bg-background">
			<Header title="Rewards Store">
				<template #left>
					<HeaderActionButton
						side="start"
						label="Spending"
						@click="router.push('/consumption')"
					>
						<ChartPie class="w-5 h-5" />
					</HeaderActionButton>
				</template>
				<template #right>
					<HeaderActionButton
						side="end"
						label="Create Reward"
						@click="router.push('/rewards/new')"
					>
						<Plus class="w-5 h-5" />
					</HeaderActionButton>
				</template>
			</Header>

			<!-- Points Card -->
			<div class="p-4 pt-2">
				<PointsCard :current-points="currentPoints" />
			</div>

			<!-- Search + Manage -->
			<div class="px-4 pb-2 flex items-center gap-2">
				<div class="flex-1 min-w-0">
					<SearchBar v-model="searchQuery" placeholder="Search for rewards" />
				</div>
				<button
					class="flex items-center gap-1.5 rounded-full px-3 h-12 text-sm font-medium text-primary hover:bg-surface transition-colors shrink-0"
					@click="router.push('/rewards/manage')"
				>
					<ListChecks class="w-4 h-4" />
					<span>Manage</span>
				</button>
			</div>
		</div>

		<!-- Rewards Grid -->
		<main class="p-4">
			<RewardsGrid
				:rewards="filteredRewards"
				:is-loading="isLoading"
				@reward-click="handleRewardClick"
			/>
		</main>

		<!-- Reward Detail Popup -->
		<RModal
			:visible="isPopupOpen"
			direction="bottom"
			max-height="80vh"
			title="Reward Details"
			@close="isPopupOpen = false"
		>
			<template v-if="selectedReward" #header-right>
				<div class="flex items-center gap-3">
					<button
						v-if="selectedReward.template.replenishmentMode !== 'none'"
						class="flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
						@click="goToReplenishment"
					>
						<History class="w-5 h-5" />
					</button>
					<button
						class="flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
						@click="goToEditReward"
					>
						<Pencil class="w-5 h-5" />
					</button>
				</div>
			</template>

			<RewardDetailPopup
				v-if="selectedReward"
				:reward="selectedReward"
				v-model:quantity="redeemQuantity"
				v-model:note="redeemNote"
				:max-quantity="maxQuantity"
				:current-points="currentPoints"
				:is-action-loading="isActionLoading"
				:redeem-error="redeemError"
				@redeem="handlePurchase"
			/>
		</RModal>
	</div>
</template>

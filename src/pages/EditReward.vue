<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import Header from "@/components/Header.vue";
import RadioGroup from "@/components/RadioGroup.vue";
import IconPicker from "@/components/IconPicker.vue";
import DynamicIcon from "@/components/DynamicIcon.vue";
import MultiSelectGrid from "@/components/MultiSelectGrid.vue";
import NumberInput from "@/components/NumberInput.vue";
import { Package, Scale, Sparkles } from "lucide-vue-next";
import type {
	RewardTemplate,
	RewardIconName,
	RewardIconColor,
	ReplenishmentMode,
} from "@/db/types";
import { REWARD_ICON_COLORS } from "@/db/types";
import { isValidMoneyCost, formatMoney } from "@/libs/reward";
import { toPlain } from "@/libs/plain";
import { useRewardTemplate, useRewardTemplateActions } from "@/composables/useRewards";
import { useAlert } from "@/composables/useConfirm";
import { useUserStore } from "@/store";

const restockOptions = ["None", "Daily", "Weekly", "Monthly"];
const restockValues: ReplenishmentMode[] = ["none", "daily", "weekly", "monthly"];

const weekDays = [
	{ label: "Sun", value: 0 },
	{ label: "Mon", value: 1 },
	{ label: "Tue", value: 2 },
	{ label: "Wed", value: 3 },
	{ label: "Thu", value: 4 },
	{ label: "Fri", value: 5 },
	{ label: "Sat", value: 6 },
];

const monthDays = Array.from({ length: 31 }, (_, i) => ({
	label: String(i + 1),
	value: i + 1,
}));

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const id = computed(() => {
	const raw = route.params.id;
	return typeof raw === "string" ? raw : undefined;
});
const rewardId = computed(() =>
	id.value && id.value !== "new" ? id.value : null,
);
const isEditing = computed(() => Boolean(rewardId.value));

// 使用 composable 获取奖励模板数据
const { template, isLoading: isLoadingTemplate } = useRewardTemplate(
	() => rewardId.value,
);
const {
	create,
	update,
	isLoading: isSubmitting,
} = useRewardTemplateActions();

// 不用原生 alert()：Android WebView 会静默丢弃、Electron 里会阻塞渲染进程
const alertDialog = useAlert();

// Basic Info
const title = ref("");
const description = ref("");
const pointsCost = ref(100);
// 单件折合金额（元）：与积分价互相独立，消费金额 = 单件金额 × 数量
const moneyCost = ref(100);
// 是否折合金额并计入消费统计：关闭后不折合金额，之后的购买不计入消费统计
const countInConsumption = ref(true);
const enabled = ref(true);

// Icon
const selectedIcon = ref<RewardIconName>("Gift");
const selectedColor = ref<RewardIconColor>(REWARD_ICON_COLORS[0]);
const isIconPickerOpen = ref(false);

// Replenishment
const restockIndex = ref(0);
const repeatInterval = ref(1);
const repeatDaysOfWeek = ref<number[]>([]);
const repeatDaysOfMonth = ref<number[]>([]);
const replenishmentNum = ref(1);
const hasStockLimit = ref(false);
const replenishmentLimit = ref(10);

// 加载现有奖励数据
watch(
	template,
	(value) => {
		if (!value) return;
		title.value = value.title;
		description.value = value.description ?? "";
		pointsCost.value = value.pointsCost;
		moneyCost.value = value.moneyCost ?? 0;
		countInConsumption.value = value.countInConsumption !== false;
		enabled.value = value.enabled;
		selectedIcon.value = value.icon;
		selectedColor.value = value.iconColor ?? REWARD_ICON_COLORS[0];

		restockIndex.value = restockValues.indexOf(value.replenishmentMode);
		repeatInterval.value = value.repeatInterval ?? 1;
		repeatDaysOfWeek.value = value.repeatDaysOfWeek ?? [];
		repeatDaysOfMonth.value = value.repeatDaysOfMonth ?? [];
		replenishmentNum.value = value.replenishmentNum ?? 1;
		hasStockLimit.value = value.replenishmentLimit !== undefined;
		replenishmentLimit.value = value.replenishmentLimit ?? 10;
	},
	{ immediate: true },
);

function handleIconSelect(icon: RewardIconName, color: RewardIconColor) {
	selectedIcon.value = icon;
	selectedColor.value = color;
}

function handleWeekDayChange(day: number) {
	repeatDaysOfWeek.value = repeatDaysOfWeek.value.includes(day)
		? repeatDaysOfWeek.value.filter((d) => d !== day)
		: [...repeatDaysOfWeek.value, day].sort((a, b) => a - b);
}

function handleMonthDayChange(day: number) {
	repeatDaysOfMonth.value = repeatDaysOfMonth.value.includes(day)
		? repeatDaysOfMonth.value.filter((d) => d !== day)
		: [...repeatDaysOfMonth.value, day].sort((a, b) => a - b);
}

async function handleSubmit() {
	if (!user.value?.id) return;

	// 关闭统计时不需要校验金额（金额仅保留，便于重新打开）
	if (countInConsumption.value && !isValidMoneyCost(moneyCost.value)) {
		await alertDialog({
			title: "Invalid Value",
			message: "Unit value must be a number greater than or equal to 0",
			confirmLabel: "OK",
		});
		return;
	}

	const rewardData: Omit<RewardTemplate, "id" | "createdAt" | "updatedAt"> = toPlain({
		userId: user.value.id,
		title: title.value,
		description: description.value || undefined,
		pointsCost: pointsCost.value,
		moneyCost: moneyCost.value,
		countInConsumption: countInConsumption.value,
		enabled: enabled.value,
		replenishmentMode: restockValues[restockIndex.value],
		repeatInterval:
			restockValues[restockIndex.value] !== "none"
				? repeatInterval.value
				: undefined,
		repeatDaysOfWeek:
			restockValues[restockIndex.value] === "weekly"
				? repeatDaysOfWeek.value
				: undefined,
		repeatDaysOfMonth:
			restockValues[restockIndex.value] === "monthly"
				? repeatDaysOfMonth.value
				: undefined,
		replenishmentNum:
			restockValues[restockIndex.value] !== "none"
				? replenishmentNum.value
				: undefined,
		replenishmentLimit: hasStockLimit.value
			? replenishmentLimit.value
			: undefined,
		icon: selectedIcon.value,
		iconColor: selectedColor.value,
	});

	try {
		if (isEditing.value && rewardId.value) {
			// 消费额度由补货流程管理，编辑时不改动
			await update(rewardId.value, rewardData);
		} else {
			await create(rewardData);
		}
		router.back();
	} catch (err) {
		console.error("Failed to save reward:", err);
		await alertDialog({
			title: "Save Failed",
			message: err instanceof Error ? err.message : "Failed to save",
			confirmLabel: "OK",
		});
	}
}

const restockMode = computed(() => restockValues[restockIndex.value]);

const restockIntervalSuffix = computed(() =>
	restockMode.value === "daily"
		? "days"
		: restockMode.value === "weekly"
			? "weeks"
			: "months",
);

const moneyPreview = computed(() =>
	isValidMoneyCost(moneyCost.value) ? formatMoney(moneyCost.value) : "-",
);

// 停用（enabled = false）就是「下架」：奖品不再出现在商店、也不再参与补货，
// 但消费记录与补货记录都保留，且可以随时重新启用（/rewards/manage）
</script>

<template>
	<!-- 加载中状态 -->
	<div
		v-if="isEditing && isLoadingTemplate"
		class="min-h-screen bg-background flex items-center justify-center"
	>
		<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
	</div>

	<div v-else class="relative min-h-screen bg-background pb-32">
		<Header :title="isEditing ? 'Edit Reward' : 'Create Reward'" back />

		<main class="flex-1 px-4 py-6 space-y-6">
			<!-- Icon Selector Card -->
			<div class="rounded-xl bg-surface p-4">
				<div class="flex flex-col items-center gap-4">
					<button
						class="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-surface-light w-full"
						@click="isIconPickerOpen = true"
					>
						<div
							class="w-20 h-20 rounded-2xl flex items-center justify-center transition-colors"
							:style="{ backgroundColor: `${selectedColor}20` }"
						>
							<DynamicIcon :name="selectedIcon" :color="selectedColor" class="w-10 h-10" />
						</div>
						<div class="flex items-center gap-2 text-text-secondary text-sm">
							<span>Tap to change icon</span>
						</div>
					</button>
				</div>
			</div>

			<!-- Basic Information Card -->
			<div class="space-y-4 rounded-xl bg-surface p-4">
				<label class="flex flex-col flex-1">
					<p class="text-text-primary text-base font-medium leading-normal pb-2">
						Reward Name
					</p>
					<input
						v-model="title"
						type="text"
						placeholder="e.g., Watch a movie"
						class="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light h-14 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
					/>
				</label>

				<label class="flex flex-col flex-1">
					<p class="text-text-primary text-base font-medium leading-normal pb-2">
						Description (optional)
					</p>
					<textarea
						v-model="description"
						placeholder="e.g., Watch a movie after completing all tasks"
						class="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent bg-surface-light min-h-24 placeholder:text-text-muted p-4 text-base font-normal leading-normal"
					/>
				</label>

				<!-- Points Cost -->
				<div class="flex items-center gap-4 min-h-14 justify-between pt-2">
					<div class="flex items-center gap-4">
						<div class="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
							<Sparkles class="w-5 h-5" />
						</div>
						<p class="text-text-primary text-base font-normal leading-normal flex-1 truncate">
							Point Cost
						</p>
					</div>
					<NumberInput v-model="pointsCost" :min="0" :step="10" size="lg" />
				</div>

				<!-- Enabled Toggle -->
				<div class="flex items-center gap-4 min-h-14 justify-between pt-2">
					<p class="text-text-primary text-base font-normal leading-normal">Enabled</p>
					<button
						:class="`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
							enabled ? 'bg-primary' : 'bg-surface-light'
						}`"
						@click="enabled = !enabled"
					>
						<span
							:class="`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
								enabled ? 'translate-x-6' : 'translate-x-1'
							}`"
						/>
					</button>
				</div>
			</div>

			<!-- Unit Value Section：单件金额与积分价互相独立 -->
			<div>
				<div class="flex items-center justify-between gap-4 px-2 pb-2 pt-4">
					<h3 class="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
						Unit Value
					</h3>
					<button
						role="switch"
						:aria-checked="countInConsumption"
						aria-label="Count in spending"
						:class="`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
							countInConsumption ? 'bg-primary' : 'bg-surface-light'
						}`"
						@click="countInConsumption = !countInConsumption"
					>
						<span
							:class="`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
								countInConsumption ? 'translate-x-6' : 'translate-x-1'
							}`"
						/>
					</button>
				</div>
				<div class="rounded-xl bg-surface p-4 space-y-4">
					<template v-if="countInConsumption">
						<div class="flex items-center gap-4 min-h-10 justify-between">
							<div class="flex items-center gap-4">
								<div class="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
									<Scale class="w-5 h-5" />
								</div>
								<p class="text-text-primary text-base font-normal leading-normal">
									Unit value (¥)
								</p>
							</div>
							<NumberInput
								v-model="moneyCost"
								:min="0"
								:step="1"
								:allow-decimal="true"
								size="lg"
							/>
						</div>

						<p class="text-text-muted text-sm pt-2 border-t border-surface-light">
							Money value of one item. Free rewards with 0 point cost (e.g. a daily free quota) are recorded with it, e.g. ¥1 each.
						</p>

						<div class="flex items-center justify-between pt-2 border-t border-surface-light">
							<span class="text-text-secondary text-sm">
								{{ `${pointsCost} points / item equals` }}
							</span>
							<span class="text-green-400 font-bold">{{ moneyPreview }}</span>
						</div>
					</template>
					<p v-else class="text-text-muted text-sm">
						No money value — excluded from spending stats
					</p>
				</div>
			</div>

			<!-- Restock Cycle Section -->
			<div>
				<h3 class="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] px-2 pb-2 pt-4">
					Auto Restock
				</h3>
				<div class="rounded-xl bg-surface p-4 space-y-4">
					<RadioGroup
						:list="restockOptions"
						:model-value="restockIndex"
						@update:model-value="(index) => (restockIndex = index)"
					/>

					<!-- Restock Interval -->
					<div
						v-if="restockMode !== 'none'"
						class="flex items-center gap-4 pt-2 border-t border-surface-light"
					>
						<NumberInput
							v-model="repeatInterval"
							:min="1"
							label="Every"
							:suffix="restockIntervalSuffix"
						/>
					</div>

					<!-- Weekly Restock Days -->
					<div v-if="restockMode === 'weekly'" class="pt-2 border-t border-surface-light">
						<p class="text-text-secondary text-sm mb-3">Restock on</p>
						<MultiSelectGrid
							:list="weekDays"
							:value="repeatDaysOfWeek"
							:max-col="7"
							@change="handleWeekDayChange"
						/>
					</div>

					<!-- Monthly Restock Days -->
					<div v-if="restockMode === 'monthly'" class="pt-2 border-t border-surface-light">
						<p class="text-text-secondary text-sm mb-3">Restock on</p>
						<MultiSelectGrid
							:list="monthDays"
							:value="repeatDaysOfMonth"
							:max-col="7"
							@change="handleMonthDayChange"
						/>
					</div>

					<!-- Restock Amount -->
					<div
						v-if="restockMode !== 'none'"
						class="flex items-center gap-4 pt-2 border-t border-surface-light"
					>
						<NumberInput
							v-model="replenishmentNum"
							:min="1"
							label="Restock amount"
						/>
					</div>

					<!-- Stock Limit -->
					<div
						v-if="restockMode !== 'none'"
						class="space-y-4 pt-2 border-t border-surface-light"
					>
						<div class="flex items-center gap-4 min-h-10 justify-between">
							<div class="flex items-center gap-4">
								<div class="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
									<Package class="w-5 h-5" />
								</div>
								<p class="text-text-primary text-base font-normal leading-normal">
									Stock Limit
								</p>
							</div>
							<button
								:class="`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
									hasStockLimit ? 'bg-primary' : 'bg-surface-light'
								}`"
								@click="hasStockLimit = !hasStockLimit"
							>
								<span
									:class="`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
										hasStockLimit ? 'translate-x-6' : 'translate-x-1'
									}`"
								/>
							</button>
						</div>

						<div v-if="hasStockLimit" class="flex items-center gap-4">
							<NumberInput
								v-model="replenishmentLimit"
								:min="1"
								label="Max stock"
							/>
						</div>
					</div>
				</div>
			</div>
		</main>

		<!-- Bottom CTA Button -->
		<div class="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-background to-transparent">
			<button
				:disabled="!title.trim() || isSubmitting"
				class="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				@click="handleSubmit"
			>
				<div
					v-if="isSubmitting"
					class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"
				/>
				<template v-else>{{ isEditing ? "Update Reward" : "Create Reward" }}</template>
			</button>
		</div>

		<!-- Icon Picker Modal -->
		<IconPicker
			:is-open="isIconPickerOpen"
			:selected-icon="selectedIcon"
			:selected-color="selectedColor"
			@close="isIconPickerOpen = false"
			@select="handleIconSelect"
		/>
	</div>
</template>

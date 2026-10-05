<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { liveQuery, type Subscription } from "dexie";
import { Loader2, Sparkles, Trophy } from "lucide-vue-next";
import { getDB } from "@/db";
import {
	abandonAchievement,
	acceptAchievement,
	deleteAchievement,
	deleteProposals,
	evaluateAll,
	type AcceptAchievementOverrides,
} from "@/db/services";
import type { Achievement } from "@/db/types";
import { useConfirm } from "@/composables/useConfirm";
import { useUserStore } from "@/store";
import { useAchievementStore } from "@/store/achievementStore";
import Header from "@/components/Header.vue";
import FilterTabs from "@/components/FilterTabs.vue";
import EmptyState from "@/components/EmptyState.vue";
import Popup from "@/components/Popup.vue";
import {
	generateAchievements,
	generatePresetAchievements,
} from "@/services/achievementGenerator";
import { isLlmConfigured } from "@/services/llmService";
import AchievementCard from "./components/AchievementCard.vue";
import AchievementProposalCard from "./components/AchievementProposalCard.vue";
import AchievementAcceptDialog from "./components/AchievementAcceptDialog.vue";
import {
	ACHIEVEMENT_EMPTY_TEXT,
	ACHIEVEMENT_TABS,
	ACHIEVEMENT_TAB_LABEL,
	resolveTemplateTitle,
	type AchievementTab,
} from "./lib";

const router = useRouter();
const confirmDialog = useConfirm();
const userStore = useUserStore();
const achievementStore = useAchievementStore();
const { user } = storeToRefs(userStore);
const userId = computed(() => user.value?.id ?? null);

const achievements = ref<Achievement[]>([]);
const templateTitles = ref<Map<string, string>>(new Map());
const tab = ref<AchievementTab>("proposed");
const isGenerating = ref(false);
const error = ref<string | null>(null);
const lastModel = ref<string | undefined>();
const isConfigured = ref<boolean | null>(null);
const showFallback = ref(false);
const acceptTarget = ref<Achievement | null>(null);

// 订阅成就与模板列表
let subscription: Subscription | null = null;

watch(
	userId,
	(id) => {
		subscription?.unsubscribe();
		subscription = null;
		if (!id) return;

		subscription = liveQuery(async () => {
			const db = getDB();
			const [list, templates] = await Promise.all([
				db.achievements.where("userId").equals(id).toArray(),
				db.taskTemplates.where("userId").equals(id).toArray(),
			]);
			return { list, templates };
		}).subscribe({
			next: ({ list, templates }) => {
				achievements.value = list;
				templateTitles.value = new Map(
					templates.map((item) => [item.id, item.title]),
				);
			},
			error: (subscriptionError) => {
				console.error("[Achievements] liveQuery error:", subscriptionError);
			},
		});
	},
	{ immediate: true },
);

onUnmounted(() => {
	subscription?.unsubscribe();
	subscription = null;
});

// 检查 LLM 配置
onMounted(() => {
	let mounted = true;
	isLlmConfigured()
		.then((value) => {
			if (mounted) isConfigured.value = value;
		})
		.catch(() => {
			if (mounted) isConfigured.value = false;
		});
});

// 进入页面立即判定一次
watch(
	userId,
	(id) => {
		if (!id) return;
		evaluateAll(id)
			.then((unlocked) => {
				if (unlocked.length > 0) achievementStore.pushUnlocks(unlocked);
			})
			.catch((evaluateError) => {
				console.error("[Achievements] evaluate failed:", evaluateError);
			});
	},
	{ immediate: true },
);

const counts = computed<Record<AchievementTab, number>>(() => ({
	proposed: achievements.value.filter((item) => item.status === "proposed").length,
	active: achievements.value.filter((item) => item.status === "active").length,
	unlocked: achievements.value.filter((item) => item.status === "unlocked").length,
}));

const visible = computed(() =>
	achievements.value
		.filter((item) => item.status === tab.value)
		.sort((a, b) => {
			if (tab.value === "unlocked") {
				return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
			}
			if (tab.value === "active") {
				return (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? "");
			}
			return b.createdAt.localeCompare(a.createdAt);
		}),
);

function titleOf(item: Achievement) {
	return resolveTemplateTitle(item, templateTitles.value);
}

async function handleGenerateLlm() {
	const id = userId.value;
	if (!id) return;
	isGenerating.value = true;
	error.value = null;
	try {
		const result = await generateAchievements(id);
		lastModel.value = result.model;
		tab.value = "proposed";
	} catch (generateError) {
		error.value =
			generateError instanceof Error ? generateError.message : "Error";
		showFallback.value = true;
	} finally {
		isGenerating.value = false;
	}
}

function handleGenerate() {
	if (isConfigured.value === false) {
		showFallback.value = true;
		return;
	}
	void handleGenerateLlm();
}

async function handleUsePresets() {
	const id = userId.value;
	if (!id) return;
	isGenerating.value = true;
	error.value = null;
	try {
		await generatePresetAchievements(id);
		lastModel.value = undefined;
		showFallback.value = false;
		tab.value = "proposed";
	} catch (presetError) {
		error.value = presetError instanceof Error ? presetError.message : "Error";
	} finally {
		isGenerating.value = false;
	}
}

async function handleAccept(overrides: AcceptAchievementOverrides) {
	const id = userId.value;
	if (!acceptTarget.value || !id) return;
	await acceptAchievement(acceptTarget.value.id, overrides);
	tab.value = "active";
	const unlocked = await evaluateAll(id);
	if (unlocked.length > 0) achievementStore.pushUnlocks(unlocked);
}

async function handleDismiss(id: string) {
	await deleteAchievement(id);
}

async function handleDismissAll() {
	const id = userId.value;
	if (!id) return;
	const ok = await confirmDialog({
		title: "Dismiss All",
		message: "Dismiss all pending achievement proposals?",
		variant: "warning",
	});
	if (!ok) return;
	await deleteProposals(id);
}

async function handleAbandon(achievement: Achievement) {
	const ok = await confirmDialog({
		title: "Abandon",
		message: `Abandon “${achievement.title}”? Progress will not be kept.`,
		variant: "danger",
	});
	if (!ok) return;
	await abandonAchievement(achievement.id);
}
</script>

<template>
	<div class="min-h-screen bg-background pb-24">
		<Header title="Achievements" back>
			<template v-if="counts.unlocked > 0" #right>
				<span class="flex items-center gap-1 text-primary text-sm font-medium">
					<Trophy class="w-4 h-4" />
					{{ counts.unlocked }}
				</span>
			</template>
		</Header>

		<div class="px-4 py-3">
			<button
				:disabled="isGenerating"
				class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
				@click="handleGenerate"
			>
				<Loader2 v-if="isGenerating" class="w-5 h-5 animate-spin" />
				<Sparkles v-else class="w-5 h-5" />
				{{ isGenerating ? "Generating…" : "Generate Achievements" }}
			</button>

			<p v-if="lastModel && !isGenerating" class="text-text-muted text-xs text-center mt-2">
				{{ `Generated by ${lastModel} — progress starts from zero once accepted` }}
			</p>

			<p v-if="error" class="text-primary text-xs text-center mt-2">{{ error }}</p>
		</div>

		<div class="px-4">
			<FilterTabs
				:options="ACHIEVEMENT_TABS"
				:active-filter="tab"
				@change="(t) => (tab = t)"
			>
				<template #label="{ option }">
					{{ `${ACHIEVEMENT_TAB_LABEL[option]} (${counts[option]})` }}
				</template>
			</FilterTabs>

			<div v-if="tab === 'proposed' && counts.proposed > 1" class="flex justify-end mb-2">
				<button
					class="text-text-muted text-xs hover:text-primary transition-colors"
					@click="handleDismissAll"
				>
					Dismiss All
				</button>
			</div>
		</div>

		<div class="px-4">
			<EmptyState
				v-if="visible.length === 0"
				:title="ACHIEVEMENT_EMPTY_TEXT[tab]"
				:description="
					tab === 'proposed'
						? 'Tap the button above to let AI craft challenges from your tasks'
						: undefined
				"
			>
				<Trophy class="w-8 h-8" />
			</EmptyState>

			<template v-else-if="tab === 'proposed'">
				<AchievementProposalCard
					v-for="item in visible"
					:key="item.id"
					:achievement="item"
					:template-title="titleOf(item)"
					@accept="acceptTarget = item"
					@dismiss="handleDismiss(item.id)"
				/>
			</template>

			<template v-else>
				<AchievementCard
					v-for="item in visible"
					:key="item.id"
					:achievement="item"
					:template-title="titleOf(item)"
					v-on="tab === 'active' ? { abandon: () => handleAbandon(item) } : {}"
				/>
			</template>
		</div>

		<AchievementAcceptDialog
			:is-open="acceptTarget !== null"
			:achievement="acceptTarget"
			:template-title="acceptTarget ? titleOf(acceptTarget) : undefined"
			@close="acceptTarget = null"
			@confirm="handleAccept"
		/>

		<Popup
			:is-open="showFallback"
			position="center"
			title="Generate Achievements"
			@close="showFallback = false"
		>
			<div class="p-4">
				<p class="text-text-secondary text-sm mb-4">
					{{
						isConfigured === false
							? "No AI service configured yet. Fill in Base URL, model and API Key in Settings, or use the built-in suggestions."
							: "Generation failed. Check your AI settings, or use the built-in suggestions."
					}}
				</p>
				<div class="flex flex-col gap-3">
					<button
						class="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
						@click="
							() => {
								showFallback = false;
								router.push('/settings');
							}
						"
					>
						Open Settings
					</button>
					<button
						class="w-full py-3 rounded-xl bg-surface border border-border text-text-primary font-medium hover:bg-surface-light transition-colors"
						@click="handleUsePresets"
					>
						Use Suggestions
					</button>
				</div>
			</div>
		</Popup>
	</div>
</template>

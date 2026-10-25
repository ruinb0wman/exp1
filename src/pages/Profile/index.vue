<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { Settings } from "@lucide/vue";
import Header from "@/components/Header.vue";
import HeaderActionButton from "@/components/HeaderActionButton.vue";
import { useUserStore } from "@/store";
import { useProfileStats } from "@/composables/useProfileStats";
import { useAchievements } from "@/composables/useAchievements";
import { quickActions } from "./lib";
import UserInfoSection from "./components/UserInfoSection.vue";
import ProfilePointsCard from "./components/ProfilePointsCard.vue";
import QuickActions from "./components/QuickActions.vue";
import StatsSection from "./components/StatsSection.vue";
import RecentHistoryList from "./components/RecentHistoryList.vue";

const router = useRouter();
const userStore = useUserStore();
const { user, currentPoints, isLoading: userLoading } = storeToRefs(userStore);

onMounted(() => void userStore.calculatePoints());

const {
	stats,
	recentHistory,
	isLoading: statsLoading,
} = useProfileStats(() => user.value?.id ?? null);

const { achievements } = useAchievements(() => user.value?.id ?? null);

const unlockedCount = computed(
	() => achievements.value.filter((item) => item.status === "unlocked").length,
);

const actions = computed(() =>
	quickActions.map((action) =>
		action.path === "/achievements"
			? { ...action, badge: unlockedCount.value }
			: action,
	),
);

const isLoading = computed(() => userLoading.value || statsLoading.value);
</script>

<template>
	<div class="min-h-screen pb-24 bg-background">
		<Header title="My Profile">
			<template #right>
				<HeaderActionButton
					side="end"
					label="Settings"
					@click="router.push('/settings')"
				>
					<Settings class="w-5 h-5" />
				</HeaderActionButton>
			</template>
		</Header>
		<UserInfoSection :user="user" />
		<ProfilePointsCard :current-points="currentPoints" />
		<QuickActions
			:actions="actions"
			@action-click="(path) => router.push(path)"
		/>
		<StatsSection :stats="stats" :is-loading="isLoading" />
		<RecentHistoryList :history="recentHistory" :is-loading="isLoading" />
	</div>
</template>

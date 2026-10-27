<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { Sparkles } from "@lucide/vue";
import DynamicIcon from "@/components/DynamicIcon.vue";
import { RModal } from "@ruinb0w/ui";
import { useAchievementStore } from "@/store/achievementStore";

/** 全局解锁提示：依次展示本次新解锁的成就 */
const achievementStore = useAchievementStore();
const { pendingUnlocks } = storeToRefs(achievementStore);

const current = computed(() => pendingUnlocks.value[0]);

function handleClose() {
	achievementStore.shiftUnlock();
}
</script>

<template>
	<RModal
		v-if="current"
		:visible="true"
		direction="center"
		:closable="false"
		:close-on-overlay="false"
		width="320px"
		@close="handleClose"
	>
		<div class="flex flex-col items-center text-center py-6 px-2">
			<div class="relative mb-5">
				<div class="absolute inset-0 rounded-full bg-primary/30 blur-2xl" />
				<div class="relative w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white">
					<DynamicIcon :name="current.icon" class="w-12 h-12" />
				</div>
			</div>

			<div class="flex items-center gap-1.5 text-primary text-xs font-medium mb-2">
				<Sparkles class="w-3.5 h-3.5" />
				Achievement Unlocked
			</div>

			<h2 class="text-text-primary text-xl font-bold mb-1">{{ current.title }}</h2>
			<p v-if="current.description" class="text-text-secondary text-sm mb-3">
				{{ current.description }}
			</p>

			<p class="text-primary text-2xl font-bold mb-6">
				+{{ current.rewardPoints }}
				<span class="text-sm font-medium ml-1">exp</span>
			</p>

			<button
				class="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
				@click="handleClose"
			>
				{{ pendingUnlocks.length > 1 ? `Next (${pendingUnlocks.length - 1} more)` : "Awesome" }}
			</button>
		</div>
	</RModal>
</template>

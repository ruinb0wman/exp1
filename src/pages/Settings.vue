<script setup lang="ts">
import { MobileTimePicker } from "@ruinb0w/ui";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { ChevronLeft, Clock, Download, Info } from "@lucide/vue";
import Header from "@/components/Header.vue";
import AiSettingsSection from "@/components/AiSettingsSection.vue";
import { useUserStore } from "@/store";
import { updateUserDayEndTime } from "@/db/services";

const router = useRouter();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const dayEndTime = ref(user.value?.dayEndTime || "00:00");
const showTimePicker = ref(false);
const isSaving = ref(false);

watch(
	() => user.value?.dayEndTime,
	(value) => {
		if (value) dayEndTime.value = value;
	},
);

async function handleTimeChange(newTime: string) {
	if (!user.value?.id) return;

	isSaving.value = true;
	try {
		await updateUserDayEndTime(user.value.id, newTime);
		await userStore.refreshUser();
		dayEndTime.value = newTime;
	} catch (error) {
		console.error("Failed to update day end time:", error);
	} finally {
		isSaving.value = false;
	}
}

function getTimeDescription(time: string) {
	if (time === "00:00") return "Natural day (midnight)";
	const [hour] = time.split(":").map(Number);
	if (hour < 6) return `Dawn ${time}`;
	if (hour < 12) return `Morning ${time}`;
	if (hour === 12) return `Noon ${time}`;
	if (hour < 18) return `Afternoon ${time}`;
	return `Evening ${time}`;
}

const timeDescription = computed(() => getTimeDescription(dayEndTime.value));
</script>

<template>
	<div class="bg-background min-h-screen">
		<Header title="Settings" back />

		<div class="p-4">
			<AiSettingsSection />

			<div class="mb-6">
				<h2 class="text-text-secondary text-sm font-medium px-2 mb-3">
					Time Settings
				</h2>
				<button
					:disabled="isSaving"
					class="w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left disabled:opacity-50"
					@click="showTimePicker = true"
				>
					<div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
						<Clock class="w-5 h-5 text-primary" />
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-text-primary font-medium">Day End Time</p>
						<p class="text-text-secondary text-sm truncate">
							{{ timeDescription }} · Tasks won't expire before this time
						</p>
					</div>
					<span class="text-primary font-medium">{{ dayEndTime }}</span>
				</button>
			</div>

			<div class="flex flex-col gap-3 mb-6">
				<h2 class="text-text-secondary text-sm font-medium px-2">
					Data Management
				</h2>
				<button
					class="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left"
					@click="router.push('/data-import-export')"
				>
					<div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
						<Download class="w-5 h-5 text-primary" />
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-text-primary font-medium">Import & Export</p>
						<p class="text-text-secondary text-sm truncate">
							Backup or restore your tasks and rewards
						</p>
					</div>
					<ChevronLeft class="w-5 h-5 text-text-secondary rotate-180 shrink-0" />
				</button>
			</div>

			<div>
				<h2 class="text-text-secondary text-sm font-medium px-2 mb-3">About</h2>
				<div class="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
					<div class="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
						<Info class="w-5 h-5 text-text-secondary" />
					</div>
					<div class="flex-1">
						<p class="text-text-primary font-medium">Version</p>
						<p class="text-text-secondary text-sm">v0.1.0</p>
					</div>
				</div>
			</div>
		</div>

		<MobileTimePicker
			v-model="dayEndTime"
			:is-open="showTimePicker"
			title="Day End Time"
			:minute-interval="15"
			@close="showTimePicker = false"
			@update:model-value="handleTimeChange"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Loader2 } from "@lucide/vue";
import {
	ACHIEVEMENT_ICONS,
	type Achievement,
	type AchievementIconName,
} from "@/db/types";
import type { AcceptAchievementOverrides } from "@/db/services";
import DynamicIcon from "@/components/DynamicIcon.vue";
import { BaseModal, BInputNumber } from "@ruinb0w/ui";
import { formatCondition } from "@/libs/achievement/formatCondition";

const props = defineProps<{
	isOpen: boolean;
	achievement: Achievement | null;
	templateTitle?: string;
}>();

const emit = defineEmits<{
	close: [];
	confirm: [overrides: AcceptAchievementOverrides];
}>();

const title = ref("");
const description = ref("");
const icon = ref<AchievementIconName>("Trophy");
const rewardPoints = ref(50);
const isSaving = ref(false);

watch(
	() => [props.isOpen, props.achievement] as const,
	() => {
		if (props.isOpen && props.achievement) {
			title.value = props.achievement.title;
			description.value = props.achievement.description;
			icon.value = props.achievement.icon;
			rewardPoints.value = props.achievement.rewardPoints;
			isSaving.value = false;
		}
	},
	{ immediate: true },
);

async function handleConfirm() {
	if (!props.achievement) return;
	isSaving.value = true;
	try {
		emit("confirm", {
			title: title.value.trim() || props.achievement.title,
			description: description.value.trim(),
			icon: icon.value,
			rewardPoints: rewardPoints.value,
		});
		emit("close");
	} finally {
		isSaving.value = false;
	}
}

function handleTitleInput(event: Event) {
	title.value = (event.target as HTMLInputElement).value.slice(0, 40);
}

function handleDescriptionInput(event: Event) {
	description.value = (event.target as HTMLTextAreaElement).value.slice(0, 120);
}
</script>

<template>
	<BaseModal
		v-if="achievement"
		:visible="isOpen"
		direction="bottom"
		title="Accept Achievement"
		max-height="85vh"
		@close="emit('close')"
	>
		<div class="pb-2">
			<div class="rounded-xl bg-surface-light p-3 mb-4">
				<p class="text-text-secondary text-xs mb-1">Condition</p>
				<p class="text-text-primary text-sm font-medium">
					{{ formatCondition(achievement.condition, templateTitle ?? achievement.templateTitleSnapshot) }}
				</p>
				<p class="text-text-muted text-xs mt-1">
					Progress starts counting from now. You can adjust the reward points.
				</p>
			</div>

			<label class="block text-text-secondary text-sm mb-2">Title</label>
			<input
				:value="title"
				class="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary mb-4"
				@input="handleTitleInput"
			/>

			<label class="block text-text-secondary text-sm mb-2">Description</label>
			<textarea
				:value="description"
				rows="2"
				class="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary resize-none mb-4"
				@input="handleDescriptionInput"
			/>

			<label class="block text-text-secondary text-sm mb-2">Icon</label>
			<div class="grid grid-cols-8 gap-2 mb-4">
				<button
					v-for="name in ACHIEVEMENT_ICONS"
					:key="name"
					:aria-label="name"
					:class="`aspect-square rounded-lg flex items-center justify-center transition-colors ${
						icon === name
							? 'bg-primary text-white'
							: 'bg-surface text-text-secondary hover:bg-surface-light'
					}`"
					@click="icon = name"
				>
					<DynamicIcon :name="name" class="w-5 h-5" />
				</button>
			</div>

			<label class="block text-text-secondary text-sm mb-2">Reward Points</label>
			<BInputNumber
				:model-value="rewardPoints"
				:min="1"
				:max="1000"
				:step="5"
				:allow-decimal="false"
				:value-on-clear="1"
				@update:model-value="(v) => (rewardPoints = v ?? 1)"
			/>
		</div>

		<template #footer>
			<button
				:disabled="isSaving"
				class="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
				@click="handleConfirm"
			>
				<Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
				Accept
			</button>
		</template>
	</BaseModal>
</template>

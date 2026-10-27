<script setup lang="ts">
import { RModal } from "@ruinb0w/ui";
import DurationSlider from "./DurationSlider.vue";
import type { PomoSettings } from "@/db/types/pomo";

defineProps<{
	isOpen: boolean;
	settings: PomoSettings;
}>();

const emit = defineEmits<{
	close: [];
	updateSettings: [settings: Partial<PomoSettings>];
}>();
</script>

<template>
	<RModal
		:visible="isOpen"
		direction="center"
		width="92%"
		height="auto"
		title="Pomodoro Settings"
		@close="emit('close')"
	>
		<div class="space-y-6 w-80">
			<!-- 时长设置 -->
			<DurationSlider
				label="Focus Duration"
				:model-value="settings.focusDuration"
				:min="1"
				:max="60"
				unit="min"
				@update:model-value="(v) => emit('updateSettings', { focusDuration: v })"
			/>

			<DurationSlider
				label="Short Break Duration"
				:model-value="settings.shortBreakDuration"
				:min="1"
				:max="15"
				unit="min"
				@update:model-value="(v) => emit('updateSettings', { shortBreakDuration: v })"
			/>

			<DurationSlider
				label="Long Break Duration"
				:model-value="settings.longBreakDuration"
				:min="5"
				:max="30"
				unit="min"
				@update:model-value="(v) => emit('updateSettings', { longBreakDuration: v })"
			/>

			<DurationSlider
				label="Long Break Interval"
				:model-value="settings.longBreakInterval"
				:min="2"
				:max="8"
				unit="pomodoros"
				@update:model-value="(v) => emit('updateSettings', { longBreakInterval: v })"
			/>

			<!-- 自动开始设置 -->
			<div class="space-y-3 pt-2 border-t border-border">
				<label class="flex items-center justify-between">
					<span class="text-text-secondary text-sm">Auto-start Breaks</span>
					<button
						:class="`w-12 h-6 rounded-full transition-colors relative ${
							settings.autoStartBreaks ? 'bg-primary' : 'bg-surface-light'
						}`"
						@click="emit('updateSettings', { autoStartBreaks: !settings.autoStartBreaks })"
					>
						<div
							:class="`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
								settings.autoStartBreaks ? 'left-7' : 'left-1'
							}`"
						/>
					</button>
				</label>

				<label class="flex items-center justify-between">
					<span class="text-text-secondary text-sm">Auto-start Focus</span>
					<button
						:class="`w-12 h-6 rounded-full transition-colors relative ${
							settings.autoStartPomos ? 'bg-primary' : 'bg-surface-light'
						}`"
						@click="emit('updateSettings', { autoStartPomos: !settings.autoStartPomos })"
					>
						<div
							:class="`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
								settings.autoStartPomos ? 'left-7' : 'left-1'
							}`"
						/>
					</button>
				</label>
			</div>
		</div>
	</RModal>
</template>

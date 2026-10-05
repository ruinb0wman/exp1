<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Search, X } from "lucide-vue-next";
import DynamicIcon from "./DynamicIcon.vue";
import { useBackButtonHandler } from "@/composables/useBackButtonHandler";
import {
	REWARD_ICONS,
	REWARD_ICON_COLORS,
	type RewardIconName,
	type RewardIconColor,
} from "@/db/types";

const props = defineProps<{
	isOpen: boolean;
	selectedIcon: RewardIconName;
	selectedColor: RewardIconColor;
}>();

const emit = defineEmits<{
	select: [icon: RewardIconName, color: RewardIconColor];
	close: [];
}>();

const searchQuery = ref("");
const tempIcon = ref<RewardIconName>(props.selectedIcon);
const tempColor = ref<RewardIconColor>(props.selectedColor);

// 打开时把临时态同步成当前选中值
watch(
	() => [props.isOpen, props.selectedIcon, props.selectedColor] as const,
	() => {
		if (props.isOpen) {
			tempIcon.value = props.selectedIcon;
			tempColor.value = props.selectedColor;
			searchQuery.value = "";
		}
	},
	{ immediate: true },
);

const filteredIcons = computed(() =>
	REWARD_ICONS.filter((icon) =>
		icon.toLowerCase().includes(searchQuery.value.toLowerCase()),
	),
);

function handleConfirm() {
	emit("select", tempIcon.value, tempColor.value);
	emit("close");
}

function handleCancel() {
	tempIcon.value = props.selectedIcon;
	tempColor.value = props.selectedColor;
	searchQuery.value = "";
	emit("close");
}

// Android 返回手势 = 取消（与 X / 遮罩一致，含 temp 态重置）
useBackButtonHandler(
	() => props.isOpen,
	handleCancel,
);
</script>

<template>
	<div v-if="isOpen" class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleCancel" />

		<div class="relative w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200">
			<div class="flex items-center justify-between px-4 py-3 border-b border-border">
				<h3 class="text-text-primary text-lg font-bold">Select Icon</h3>
				<button
					class="p-2 rounded-lg hover:bg-surface-light transition-colors"
					@click="handleCancel"
				>
					<X class="w-5 h-5 text-text-secondary" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-4 space-y-6">
				<div class="flex items-center gap-4 p-4 bg-background rounded-xl">
					<span class="text-text-secondary text-sm">Preview:</span>
					<div
						class="w-14 h-14 rounded-xl flex items-center justify-center"
						:style="{ backgroundColor: `${tempColor}20` }"
					>
						<DynamicIcon :name="tempIcon" :color="tempColor" class="w-7 h-7" />
					</div>
					<span class="text-text-secondary text-sm ml-2">{{ tempIcon }}</span>
				</div>

				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
					<input
						v-model="searchQuery"
						type="text"
						placeholder="Search icons..."
						class="w-full h-10 pl-9 pr-4 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div>
					<p class="text-text-primary text-sm font-medium mb-3">Icon Color</p>
					<div class="flex flex-wrap gap-3">
						<button
							v-for="color in REWARD_ICON_COLORS"
							:key="color"
							:class="`w-8 h-8 rounded-full transition-all ${
								tempColor === color
									? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110'
									: 'hover:scale-110'
							}`"
							:style="{ backgroundColor: color }"
							@click="tempColor = color"
						/>
					</div>
				</div>

				<div>
					<p class="text-text-primary text-sm font-medium mb-3">
						{{ `Icons (${filteredIcons.length})` }}
					</p>
					<div class="grid grid-cols-6 gap-2">
						<button
							v-for="iconName in filteredIcons"
							:key="iconName"
							:class="`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
								tempIcon === iconName
									? 'bg-primary/20 ring-2 ring-primary'
									: 'bg-background hover:bg-surface-light'
							}`"
							@click="tempIcon = iconName"
						>
							<DynamicIcon
								:name="iconName"
								:color="tempIcon === iconName ? tempColor : '#a0a0a0'"
								class="w-5 h-5"
							/>
						</button>
					</div>
					<p v-if="filteredIcons.length === 0" class="text-center text-text-muted py-8">
						No matching icons found
					</p>
				</div>
			</div>

			<div class="flex gap-3 p-4 border-t border-border">
				<button
					class="flex-1 h-12 rounded-xl bg-surface-light text-text-primary font-bold hover:bg-surface transition-colors"
					@click="handleCancel"
				>
					Cancel
				</button>
				<button
					class="flex-1 h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-lg shadow-primary/30"
					@click="handleConfirm"
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
</template>

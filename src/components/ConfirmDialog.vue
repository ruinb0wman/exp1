<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import { AlertTriangle, X } from "lucide-vue-next";
import { useBackButtonHandler } from "@/composables/useBackButtonHandler";

const props = withDefaults(
	defineProps<{
		isOpen: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: "danger" | "warning" | "info";
	}>(),
	{
		title: "Confirm",
		confirmLabel: "Confirm",
		cancelLabel: "Cancel",
		variant: "danger",
	},
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const variantStyles = {
	danger: {
		icon: "text-red-400",
		iconBg: "bg-red-400/10",
		confirmBtn: "bg-red-500 hover:bg-red-600 text-white",
	},
	warning: {
		icon: "text-orange-400",
		iconBg: "bg-orange-400/10",
		confirmBtn: "bg-orange-500 hover:bg-orange-600 text-white",
	},
	info: {
		icon: "text-blue-400",
		iconBg: "bg-blue-400/10",
		confirmBtn: "bg-primary hover:bg-primary-light text-white",
	},
};

const styles = computed(() => variantStyles[props.variant]);

// 按 ESC 键取消
function handleKeyDown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		emit("cancel");
	}
}

watch(
	() => props.isOpen,
	(isOpen) => {
		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
		} else {
			document.removeEventListener("keydown", handleKeyDown);
		}
	},
	{ immediate: true },
);

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeyDown);
});

// Android 返回手势 = 取消
useBackButtonHandler(
	() => props.isOpen,
	() => emit("cancel"),
);
</script>

<template>
	<div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('cancel')" />

		<!-- Dialog -->
		<div class="relative w-full max-w-sm bg-surface rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
			<!-- Close button -->
			<button
				class="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors"
				@click="emit('cancel')"
			>
				<X class="w-5 h-5" />
			</button>

			<!-- Icon -->
			<div :class="`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`">
				<AlertTriangle :class="`w-6 h-6 ${styles.icon}`" />
			</div>

			<!-- Content -->
			<h3 class="text-lg font-semibold text-text-primary mb-2">{{ title }}</h3>
			<p class="text-sm text-text-secondary mb-6 leading-relaxed">{{ message }}</p>

			<!-- Actions -->
			<div class="flex items-center gap-3">
				<button
					class="flex-1 px-4 py-2.5 rounded-xl bg-surface-light text-text-primary font-medium hover:bg-surface-light/80 transition-colors"
					@click="emit('cancel')"
				>
					{{ cancelLabel }}
				</button>
				<button
					:class="`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${styles.confirmBtn}`"
					@click="emit('confirm')"
				>
					{{ confirmLabel }}
				</button>
			</div>
		</div>
	</div>
</template>

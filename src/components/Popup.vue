<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import { useBackButtonHandler } from "@/composables/useBackButtonHandler";

const props = withDefaults(
	defineProps<{
		/** 控制显示 */
		isOpen: boolean;
		/** 位置模式 */
		position: "bottom" | "center";
		/** 点击遮罩是否可关闭，默认 true */
		maskClosable?: boolean;
		/** 标题（可选） */
		title?: string;
		/** 是否显示关闭按钮，默认 true */
		showCloseButton?: boolean;
		/** 是否隐藏遮罩 */
		hideMask?: boolean;
		/** 最大高度（如 '80vh'） */
		maxHeight?: string;
		/** 宽度（center 模式有效） */
		width?: string;
	}>(),
	{
		maskClosable: true,
		showCloseButton: true,
		hideMask: false,
	},
);

const emit = defineEmits<{ close: [] }>();

const animationState = ref<"entering" | "entered" | "exiting" | "exited">(
	props.isOpen ? "entered" : "exited",
);

let animationTimer: ReturnType<typeof setTimeout> | null = null;

// 处理动画状态
watch(
	() => props.isOpen,
	(isOpen) => {
		if (animationTimer) {
			clearTimeout(animationTimer);
			animationTimer = null;
		}

		if (isOpen) {
			animationState.value = "entering";
			animationTimer = setTimeout(() => {
				animationState.value = "entered";
			}, 50);
		} else if (animationState.value !== "exited") {
			animationState.value = "exiting";
			animationTimer = setTimeout(() => {
				animationState.value = "exited";
			}, 300);
		}
	},
	{ immediate: true },
);

// 阻止背景滚动
watch(
	() => props.isOpen,
	(isOpen) => {
		document.body.style.overflow = isOpen ? "hidden" : "";
	},
	{ immediate: true },
);

// ESC 键关闭
function handleKeyDown(e: KeyboardEvent) {
	if (e.key === "Escape" && props.isOpen && animationState.value === "entered") {
		emit("close");
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
	document.body.style.overflow = "";
	if (animationTimer) clearTimeout(animationTimer);
});

// Android 返回手势关浮层（不看 maskClosable，与 ESC 语义一致；
// 用 isOpen 而不是 animationState，避免开/关动画里反复注册-注销监听）
useBackButtonHandler(
	() => props.isOpen,
	() => emit("close"),
);

const isBottom = computed(() => props.position === "bottom");
const isEntering = computed(() => animationState.value === "entering");
const isExiting = computed(() => animationState.value === "exiting");

const maskAnimationStyle = computed(() => ({
	opacity: isEntering.value ? 0 : isExiting.value ? 0 : 1,
	transition: "opacity 300ms ease-out",
}));

const contentAnimationStyle = computed(() => {
	if (isBottom.value) {
		return {
			transform: isEntering.value
				? "translateY(100%)"
				: isExiting.value
					? "translateY(100%)"
					: "translateY(0)",
			transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
		};
	}
	return {
		opacity: isEntering.value ? 0 : isExiting.value ? 0 : 1,
		transform: isEntering.value
			? "scale(0.95)"
			: isExiting.value
				? "scale(0.95)"
				: "scale(1)",
		transition:
			"opacity 200ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
	};
});

const customStyles = computed(() => ({
	maxHeight: props.maxHeight,
	width: props.width,
}));

function handleMaskClick() {
	if (props.maskClosable && animationState.value === "entered") {
		emit("close");
	}
}
</script>

<template>
	<div
		v-if="animationState !== 'exited'"
		:class="`fixed inset-0 z-[60] flex justify-center ${hideMask ? '' : 'bg-black/60'} ${isBottom ? 'items-end' : 'items-center'}`"
		:style="maskAnimationStyle"
		@click="handleMaskClick"
	>
		<!-- 内容区域 -->
		<div
			:class="`bg-[#1b1b1f] shadow-2xl flex flex-col ${isBottom ? 'w-full rounded-t-2xl' : `rounded-2xl ${width ? '' : 'max-w-lg w-[90%]'}`}`"
			:style="{ ...contentAnimationStyle, ...customStyles }"
			@click.stop
		>
			<!-- 顶部拖动条（仅 bottom 模式） -->
			<div v-if="isBottom" class="w-12 h-1.5 bg-zinc-600 rounded-full mx-auto mt-3 mb-2" />

			<!-- 头部区域 -->
			<template v-if="$slots.header">
				<div class="px-4 pt-4">
					<slot name="header" />
				</div>
			</template>
			<template v-else-if="title || showCloseButton">
				<div class="flex items-center justify-between px-4 pt-4 pb-2">
					<h2 v-if="title" class="text-xl font-bold text-white">{{ title }}</h2>
					<template v-if="showCloseButton || $slots.headerRight">
						<div v-if="$slots.headerRight">
							<slot name="headerRight" />
						</div>
						<button
							v-else
							class="p-2 rounded-full hover:bg-zinc-700 transition-colors"
							aria-label="Close"
							@click="emit('close')"
						>
							<X class="w-5 h-5 text-zinc-400" />
						</button>
					</template>
				</div>
			</template>

			<!-- 内容区域 -->
			<div class="flex-1 overflow-auto px-4 py-2">
				<slot />
			</div>

			<!-- 底部区域 -->
			<div v-if="$slots.footer" class="px-4 pb-4 pt-2">
				<slot name="footer" />
			</div>

			<!-- bottom 模式默认底部安全间距 -->
			<div v-if="isBottom && !$slots.footer" class="h-4" />
		</div>
	</div>
</template>

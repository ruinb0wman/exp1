<script setup lang="ts">
import { computed } from "vue";
import { RouterView } from "vue-router";
import { useSafeAreaInsets } from "@/composables/useSafeAreaInsets";

withDefaults(
	defineProps<{
		showBottomNav?: boolean;
	}>(),
	{
		showBottomNav: true,
	},
);

const insets = useSafeAreaInsets();

// 移动端顶部占位：优先使用安全区，读不到时用 32px 兜底
const topPadding = computed(() => insets.value.top || 32);
</script>

<template>
	<div class="layout h-screen flex flex-col bg-background overflow-hidden">
		<!-- 固定安全区域 - 状态栏占位（透明背景） -->
		<div
			class="flex-shrink-0 z-50"
			:style="{ height: `${topPadding}px` }"
		/>

		<!-- 可滚动内容区域 -->
		<div class="flex-1 relative">
			<div class="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
				<slot>
					<RouterView />
				</slot>
			</div>
		</div>

		<!-- 底部导航区域 - 由子组件控制显示 -->
		<div v-if="showBottomNav" class="flex-shrink-0 landscape:hidden" />
	</div>
</template>

<style scoped>
/* 横屏时给左侧竖栏让位（RTabBar 的宽度由库里的 --rail 决定，这里是同一份 224px） */
@media (orientation: landscape) {
	.layout {
		padding-left: 224px;
	}
}
</style>

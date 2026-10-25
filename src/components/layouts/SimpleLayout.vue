<script setup lang="ts">
import { RouterView } from "vue-router";
import { BTabBar } from "@ruinb0w/ui";
import { useTabNav } from "@/composables/useTabNav";
import BaseLayout from "./BaseLayout.vue";

const { items, isActive, select } = useTabNav();
</script>

<!--
  简单布局组件
  竖屏不显示导航，横屏时显示为左侧竖栏，用于次级页面
-->
<template>
	<BaseLayout :show-bottom-nav="false">
		<RouterView />
		<BTabBar
			class="app-tabbar app-tabbar--wide-only"
			:items="items"
			:is-active="isActive"
			rail-on-landscape
			fill-active
			@select="select"
		/>
	</BaseLayout>
</template>

<style scoped>
.app-tabbar {
	position: fixed;
	inset: auto 0 0 0;
	z-index: 50;
}

/* 次级页面竖屏不显示导航 */
.app-tabbar--wide-only {
	display: none;
}

@media (orientation: landscape) {
	.app-tabbar {
		inset: 0 auto 0 0;
		width: 224px;
		height: auto;
	}

	.app-tabbar--wide-only {
		display: flex;
	}
}
</style>

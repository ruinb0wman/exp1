<script setup lang="ts">
import { RouterView } from "vue-router";
import { BTabBar } from "@ruinb0w/ui";
import { useTabNav } from "@/composables/useTabNav";
import BaseLayout from "./BaseLayout.vue";

const { items, isActive, select } = useTabNav();
</script>

<!--
  主布局组件
  带底部导航栏（横屏时库里的 BTabBar 自己变成左侧竖栏），用于主要页面
-->
<template>
	<BaseLayout :show-bottom-nav="true">
		<RouterView />
		<BTabBar
			class="app-tabbar"
			:items="items"
			:is-active="isActive"
			rail-on-landscape
			fill-active
			@select="select"
		/>
	</BaseLayout>
</template>

<style scoped>
/* 定位归项目：库只提供样式与布局，固定方式由使用方决定 */
.app-tabbar {
	position: fixed;
	inset: auto 0 0 0;
	z-index: 50;
}

@media (orientation: landscape) {
	.app-tabbar {
		inset: 0 auto 0 0;
		width: 224px;
		height: auto;
	}
}
</style>

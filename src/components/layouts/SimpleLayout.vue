<script setup lang="ts">
import { RouterView } from "vue-router";
import BottomNav from "@/components/BottomNav.vue";
import BaseLayout from "./BaseLayout.vue";
</script>

<!--
  简单布局组件
  不带底部导航栏（横屏时显示），用于次级页面
-->
<template>
	<BaseLayout :show-bottom-nav="false">
		<RouterView />
		<!-- 横屏时显示导航栏 -->
		<div class="hidden landscape:block flex-shrink-0">
			<BottomNav />
		</div>
	</BaseLayout>
</template>

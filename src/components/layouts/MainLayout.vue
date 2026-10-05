<script setup lang="ts">
import { RouterView } from "vue-router";
import BottomNav from "@/components/BottomNav.vue";
import BaseLayout from "./BaseLayout.vue";
</script>

<!--
  主布局组件
  带底部导航栏，用于主要页面
-->
<template>
	<BaseLayout :show-bottom-nav="true">
		<RouterView />
		<BottomNav />
	</BaseLayout>
</template>

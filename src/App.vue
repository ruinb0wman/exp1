<script setup lang="ts">
import { RouterView } from "vue-router";
import { RConfirmHost } from "@ruinb0w/ui";
import AchievementUnlockDialog from "@/pages/Achievements/components/AchievementUnlockDialog.vue";
import { useAppBootstrap } from "@/composables/useAppBootstrap";

// 应用启动初始化（用户、任务订阅、番茄钟对账、成就监听）
useAppBootstrap();
</script>

<template>
	<RouterView />

	<!-- 应用级确认框/提示框宿主：useConfirm() / useAlert() 的界面挂在这里 -->
	<RConfirmHost />

	<AchievementUnlockDialog />
</template>

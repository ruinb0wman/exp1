<script setup lang="ts">
import { RouterView } from "vue-router";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import AchievementUnlockDialog from "@/pages/Achievements/components/AchievementUnlockDialog.vue";
import { resolveConfirm, useConfirmState } from "@/composables/useConfirm";
import { useAppBootstrap } from "@/composables/useAppBootstrap";

// 应用启动初始化（用户、任务订阅、番茄钟对账、成就监听）
useAppBootstrap();

const confirmState = useConfirmState();
</script>

<template>
	<RouterView />

	<ConfirmDialog
		:is-open="confirmState.isOpen"
		:title="confirmState.options?.title"
		:message="confirmState.options?.message ?? ''"
		:confirm-label="confirmState.options?.confirmLabel"
		:cancel-label="confirmState.options?.cancelLabel"
		:variant="confirmState.options?.variant"
		@confirm="resolveConfirm(true)"
		@cancel="resolveConfirm(false)"
	/>

	<AchievementUnlockDialog />
</template>
